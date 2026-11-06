import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import {
  getAttribute,
  getAttributes,
  type ZoneId,
} from "@epanet-js/hydraulic-model";
import {
  changeZoneProperties,
  mergeChangeSets,
} from "@epanet-js/hydraulic-model-operations";
import type { ChangeSet } from "@epanet-js/change-set";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { dialogAtom } from "src/state/dialog";
import { projectSettingsAtom } from "src/state/project-settings";
import { zonesVisibleAtom } from "src/state/map-symbology";
import { modelFactoriesAtom } from "src/state/model-factories";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { createTimeSlicer } from "src/infra/yield-to-main";
import {
  DataGrid,
  type DataGridRef,
  type CellContextAction,
  type GutterContextAction,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  patchModelRow,
} from "src/components/data-grid";
import { useSelection, USelection } from "src/selection";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useDeleteZones } from "src/commands/delete-zones";
import { useUserTracking } from "src/infra/user-tracking";
import { DeleteIcon, PointerClickIcon, PaywallLockIcon } from "src/icons";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { useFeatureLock } from "src/components/form/paywall";
import { RingSpinner } from "src/components/ring-spinner";
import { useLabelMaxLength } from "src/hooks/use-label-max-length";
import { usePanelGridState } from "./use-panel-grid-state";
import {
  registerTableHandleAtom,
  unregisterTableHandleAtom,
} from "./table-handles";
import { buildZoneModelRows, type ZoneRow } from "./zone-data-table-data";
import { buildZoneColumns } from "./zone-data-table-columns";
import { useDeferredGridMount } from "./use-deferred-grid-mount";

interface ZoneDataTableProps {
  id: string;
  type: "zone-table";
  zoneIds?: readonly ZoneId[];
}

export const ZoneDataTable = memo(function ZoneDataTableInner({
  id,
  type,
  zoneIds,
}: ZoneDataTableProps) {
  const dataGridRef = useRef<DataGridRef>(null);
  const [savedState, saveState] = usePanelGridState(id, type);
  const registerHandle = useSetAtom(registerTableHandleAtom);
  const unregisterHandle = useSetAtom(unregisterTableHandleAtom);

  useEffect(
    function publishCaptureHandle() {
      const handle = {
        captureState: () => {
          const state = dataGridRef.current?.captureState();
          if (state) saveState(state);
        },
      };
      registerHandle(id, handle);
      return () => unregisterHandle(id, handle);
    },
    [id, saveState, registerHandle, unregisterHandle],
  );
  const setDialogState = useSetAtom(dialogAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const { formatting } = useAtomValue(projectSettingsAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const { transact } = useModelTransaction();
  const translate = useTranslate();
  const isEditionBlocked = useIsEditionBlocked();
  const {
    isLocked: customAttributesLocked,
    openPaywall: openCustomAttributesPaywall,
  } = useFeatureLock("customAttributes");
  const zonesVisible = useAtomValue(zonesVisibleAtom);
  const { selectZones } = useSelection(selection);
  const zoomTo = useZoomTo();
  const deleteZones = useDeleteZones();
  const userTracking = useUserTracking();
  const labelMaxLength = useLabelMaxLength();

  const scopedIds = useMemo(
    () => (zoneIds ? new Set(zoneIds) : undefined),
    [zoneIds],
  );

  const rows = useMemo(
    () => buildZoneModelRows(hydraulicModel, scopedIds),
    [hydraulicModel, scopedIds],
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const gridReady = useDeferredGridMount();

  const customAttributes = useMemo(
    () => getAttributes(hydraulicModel.customAttributes, "zone"),
    [hydraulicModel.customAttributes],
  );

  const columns = useMemo(() => {
    const customAttributesLock = customAttributesLocked
      ? { openPaywall: openCustomAttributesPaywall, icon: <PaywallLockIcon /> }
      : undefined;
    return buildZoneColumns(
      translate,
      formatting,
      (label, row) => {
        const zoneId = row.id;
        if (zoneId === undefined) return true;
        return labelManager.isLabelAvailable(label, "zone", zoneId);
      },
      customAttributes,
      customAttributesLock,
      labelMaxLength,
    );
  }, [
    translate,
    formatting,
    labelManager,
    customAttributes,
    customAttributesLocked,
    openCustomAttributesPaywall,
    labelMaxLength,
  ]);

  const onChange = useCallback(
    async (newRows: ZoneRow[]) => {
      const changeSetBuilders: (() => ChangeSet)[] = [];
      const customEditCounts = new Map<string, number>();
      let labelChanges = 0;

      const yieldIfSliceElapsed = createTimeSlicer();
      for (let i = 0; i < newRows.length; i++) {
        await yieldIfSliceElapsed();
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
        if (!oldRow || newRow === oldRow) continue;

        const changes: { property: string; value: unknown }[] = [];

        if (
          typeof newRow.label === "string" &&
          newRow.label !== oldRow.label &&
          labelManager.isLabelAvailable(newRow.label, "zone", newRow.id)
        ) {
          changes.push({ property: "label", value: newRow.label });
          labelChanges += 1;
        }

        for (const attribute of customAttributes) {
          const key = attribute.id;
          if (!Object.prototype.hasOwnProperty.call(newRow, key)) continue;
          const value = (newRow as Record<string, unknown>)[key];
          changes.push({
            property: key,
            value: value === undefined ? null : value,
          });
          customEditCounts.set(key, (customEditCounts.get(key) ?? 0) + 1);
        }

        if (changes.length > 0) {
          const propertiesData = { zoneIds: [newRow.id], changes };
          changeSetBuilders.push(() =>
            changeZoneProperties(hydraulicModel, propertiesData),
          );
        }
      }

      const applied = transact(() =>
        mergeChangeSets(
          changeSetBuilders.map((build) => build()),
          "editZoneTable",
        ),
      );
      if (!applied) return;

      if (labelChanges > 0) {
        userTracking.capture({
          name: "zone.labelChanged",
          count: labelChanges,
        });
      }
      for (const [property, count] of customEditCounts) {
        const attribute = getAttribute(
          hydraulicModel.customAttributes,
          "zone",
          property,
        );
        userTracking.capture({
          name: "customAttribute.batchEdited",
          assetType: "zone",
          attributeType: attribute?.type ?? "text",
          property,
          label: attribute?.label ?? "",
          count,
        });
      }
    },
    [hydraulicModel, labelManager, transact, userTracking, customAttributes],
  );

  const getZoneIdsFromRange = useCallback(
    (sortedRows: ZoneRow[], minRow: number, maxRow: number) => {
      const ids = [];
      for (let i = minRow; i <= maxRow && i < sortedRows.length; i++) {
        const id = sortedRows[i]?.id;
        if (id !== undefined) ids.push(id);
      }
      return ids;
    },
    [],
  );

  const deleteAction = useMemo(
    () => ({
      label: translate("delete"),
      icon: <DeleteIcon />,
      variant: "destructive" as const,
      onSelect: (
        selection: { min: { row: number }; max: { row: number } },
        sortedRows: ZoneRow[],
      ) => {
        deleteZones(
          getZoneIdsFromRange(sortedRows, selection.min.row, selection.max.row),
          "data-table",
        );
      },
    }),
    [translate, deleteZones, getZoneIdsFromRange],
  );
  const showDelete = !isEditionBlocked;

  const selectInMap = useCallback(
    (ids: ZoneId[], source: "cell-context" | "gutter-context") => {
      if (ids.length === 0) return;
      selectZones(ids);
      zoomTo(USelection.fromIds([], [], ids));
      userTracking.capture({
        name: "dataTables.selectedInMap",
        type: "zone",
        source,
        count: ids.length,
      });
    },
    [selectZones, zoomTo, userTracking],
  );

  const cellContextActions = useMemo<CellContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        disabled: () => !zonesVisible,
        onSelect: (selection, sortedRows) => {
          selectInMap(
            getZoneIdsFromRange(
              sortedRows as ZoneRow[],
              selection.min.row,
              selection.max.row,
            ),
            "cell-context",
          );
        },
      },
      ...(showDelete ? [deleteAction as CellContextAction] : []),
    ],
    [
      translate,
      selectInMap,
      getZoneIdsFromRange,
      showDelete,
      deleteAction,
      zonesVisible,
    ],
  );

  const gutterContextActions = useMemo<GutterContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        disabled: () => !zonesVisible,
        onSelect: (selection, sortedRows) => {
          selectInMap(
            getZoneIdsFromRange(
              sortedRows as ZoneRow[],
              selection.min.row,
              selection.max.row,
            ),
            "gutter-context",
          );
        },
      },
      ...(showDelete ? [deleteAction as GutterContextAction] : []),
    ],
    [
      translate,
      selectInMap,
      getZoneIdsFromRange,
      showDelete,
      deleteAction,
      zonesVisible,
    ],
  );

  const handleSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      userTracking.capture({
        name: "dataTables.sorted",
        type: "zone",
        property: columnId,
        direction,
      });
    },
    [userTracking],
  );

  const handleCopy = useCallback(
    (info: ClipboardCopyInfo) => {
      const {
        requestedRows,
        rows,
        cols,
        allRows,
        allCols,
        columnIds,
        includeHeaders,
      } = info;
      const truncated = rows < requestedRows;
      userTracking.capture({
        name: "dataTables.copied",
        type: "zone",
        requestedRows,
        rows,
        cols,
        allRows,
        allCols,
        withHeaders: includeHeaders,
        columnIds,
      });

      if (truncated) {
        notify({
          variant: "default",
          title: translate(
            "dataTables.copy.truncatedTitle",
            rows.toLocaleString(),
            requestedRows.toLocaleString(),
          ),
          description: translate("dataTables.copy.truncatedDescription"),
          duration: 8000,
          position: "bottom-center",
          action: {
            label: translate("dataTables.copy.exportAction"),
            variant: "default",
            align: "inline",
            onClick: () => setDialogState({ type: "exportAssetData" }),
          },
        });
        return;
      }

      if (allRows && !includeHeaders) {
        notify({
          variant: "default",
          title: translate("dataTables.copy.includeHeadersPrompt"),
          duration: 6000,
          position: "bottom-center",
          action: {
            label: translate("dataTables.copy.includeHeadersAction"),
            variant: "default",
            align: "inline",
            onClick: () => {
              void dataGridRef.current?.copySelection({
                includeHeaders: true,
              });
            },
          },
        });
      }
    },
    [userTracking, translate, setDialogState],
  );

  const handlePaste = useCallback(
    (info: ClipboardPasteInfo) => {
      const { requestedRows, ...tracked } = info;
      userTracking.capture({
        name: "dataTables.pasted",
        type: "zone",
        ...tracked,
      });
      if (info.rows < requestedRows) {
        notify({
          variant: "default",
          title: translate(
            "dataTables.paste.cappedTitle",
            info.rows.toLocaleString(),
          ),
          description: translate("dataTables.paste.cappedDescription"),
          duration: 8000,
          position: "bottom-center",
        });
      }
    },
    [userTracking, translate],
  );

  return (
    <div className="flex-1 min-h-0 relative">
      {!gridReady ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <RingSpinner size="lg" />
        </div>
      ) : (
        <DataGrid
          ref={dataGridRef}
          initialGridState={savedState}
          data={rows}
          columns={columns}
          onChange={onChange}
          createRow={() => ({}) as ZoneRow}
          getRowId={(row) => String(row.id)}
          patchRow={patchModelRow}
          gutterColumn="selection"
          resizable
          sortable
          minColumnSizePx={20}
          readOnly={isEditionBlocked}
          cellContextActions={cellContextActions}
          gutterContextActions={gutterContextActions}
          onColumnSort={handleSort}
          onCopy={handleCopy}
          onPaste={handlePaste}
          pinnedColumns={{ left: ["label"] }}
        />
      )}
    </div>
  );
});
