import { memo, useCallback, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { dialogAtom } from "src/state/dialog";
import {
  stagingModelDerivedAtom,
  simulationResultsDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import {
  changeProperties,
  changeLabel,
  changeDemandAssignment,
  mergeMoments,
} from "src/hydraulic-model/model-operations";
import { getJunctionDemands } from "src/hydraulic-model";
import type { JunctionDemandAssignment } from "src/hydraulic-model/model-operation";
import type { ModelMoment } from "src/hydraulic-model";
import {
  tankVolumeCurveChanges,
  chemicalSourceTypeChanges,
  valveKindChanges,
  pumpDefinitionTypeChanges,
} from "src/hydraulic-model/model-operations";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import type { PropertyChange } from "src/hydraulic-model/model-operations/change-property";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  type AssetType,
  type AssetId,
  type PumpDefinitionType,
  type ValveKind,
  type ChemicalSourceType,
  type CurveId,
} from "@epanet-js/hydraulic-model";
import { getAttributes, isCustomProperty } from "@epanet-js/custom-attributes";
import {
  DataGrid,
  type DataGridRef,
  type CellContextAction,
  type GutterContextAction,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  patchModelRow,
} from "src/components/data-grid";
import { useSelectAssetsInApp } from "src/commands/select-assets-in-app";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { USelection } from "src/selection";
import { useDeleteAssets } from "src/commands/delete-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { DeleteIcon, PaywallLockIcon, PointerClickIcon } from "src/icons";
import { useFeatureLock } from "src/components/form/paywall";
import { RingSpinner } from "src/components/ring-spinner";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import {
  type AssetRow,
  type AssetAccessorCtx,
  buildAssetModelRows,
} from "./data";
import { listPipeMaterials } from "src/hydraulic-model/utilities/pipe-materials";
import { useDeferredGridMount } from "./use-deferred-grid-mount";
import {
  buildColumns,
  EDITABLE_NUMERIC_KEYS,
  EDITABLE_SELECT_KEYS,
  isNullableColumn,
  type QualityAnalysisType,
} from "./asset-data-table-columns";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { pipeMaterialLabelsAtom } from "src/state/pipe-library";

interface AssetDataTableProps {
  assetType: AssetType;
}

export const AssetDataTable = memo(function AssetDataTableInner({
  assetType,
}: AssetDataTableProps) {
  const dataGridRef = useRef<DataGridRef>(null);
  const setDialogState = useSetAtom(dialogAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useAtomValue(simulationResultsDerivedAtom);
  const simulationSettings = useAtomValue(simulationSettingsDerivedAtom);
  const { units, formatting } = useAtomValue(projectSettingsAtom);
  const { labelManager } = useAtomValue(modelFactoriesAtom);
  const { transact } = useMomentTransaction();
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const isEditionBlocked = useIsEditionBlocked();
  const selectAssetsInApp = useSelectAssetsInApp();
  const zoomTo = useZoomTo();
  const deleteAssetsAction = useDeleteAssets();
  const userTracking = useUserTracking();

  const assetIds = useMemo(() => {
    const ids: AssetId[] = [];
    for (const asset of hydraulicModel.assets.values()) {
      if (asset.type === assetType) ids.push(asset.id);
    }
    return ids;
  }, [hydraulicModel.assets, assetType]);

  const hasSimulation = simulation !== null;

  const qualityType = useMemo((): QualityAnalysisType => {
    if (!simulation) return "none";
    const id = assetIds[0];
    if (id === undefined) return "none";
    let q:
      | {
          waterAge: number | null;
          waterTrace: number | null;
          chemicalConcentration: number | null;
        }
      | null
      | undefined;
    if (assetType === "junction") q = simulation.getJunction(id);
    else if (assetType === "pipe") q = simulation.getPipe(id);
    else if (assetType === "pump") q = simulation.getPump(id);
    else if (assetType === "valve") q = simulation.getValve(id);
    else if (assetType === "reservoir") q = simulation.getReservoir(id);
    else if (assetType === "tank") q = simulation.getTank(id);
    if (!q) return "none";
    if (q.waterAge != null) return "age";
    if (q.waterTrace != null) return "trace";
    if (q.chemicalConcentration != null) return "chemical";
    return "none";
  }, [simulation, assetType, assetIds]);

  const rows = useMemo(
    () => buildAssetModelRows(assetType, hydraulicModel),
    [assetType, hydraulicModel],
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  // Defer mounting the grid so switching tabs stays responsive.
  const gridReady = useDeferredGridMount();

  const {
    isLocked: pipeAttributesLocked,
    openPaywall: openPipeAttributesPaywall,
  } = useFeatureLock("pipeAttributes");
  const {
    isLocked: customAttributesLocked,
    openPaywall: openCustomAttributesPaywall,
  } = useFeatureLock("customAttributes");
  const libraryMaterials = useAtomValue(pipeMaterialLabelsAtom);
  const pipeMaterials = useMemo(
    () =>
      assetType === "pipe"
        ? listPipeMaterials(hydraulicModel.assets, libraryMaterials)
        : [],
    [assetType, hydraulicModel.assets, libraryMaterials],
  );
  const accessorCtx = useMemo<AssetAccessorCtx>(
    () => ({ model: hydraulicModel, simulation, translate }),
    [hydraulicModel, simulation, translate],
  );
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");
  const isCustomAttributesOn = useFeatureFlag("FLAG_CUSTOM_ATTRIBUTES");
  const customAttributes = useMemo(
    () =>
      isCustomAttributesOn
        ? getAttributes(hydraulicModel.customAttributes, assetType)
        : [],
    [isCustomAttributesOn, hydraulicModel.customAttributes, assetType],
  );

  const columns = useMemo(() => {
    const validateLabel = (label: string, row: AssetRow) =>
      labelManager.isLabelAvailable(label, assetType, row.id);
    const getRow = (rowIndex: number) => rowsRef.current?.[rowIndex];
    const lock = pipeAttributesLocked
      ? {
          openPaywall: openPipeAttributesPaywall,
          icon: <PaywallLockIcon />,
        }
      : undefined;
    const customAttributesLock = customAttributesLocked
      ? {
          openPaywall: openCustomAttributesPaywall,
          icon: <PaywallLockIcon />,
        }
      : undefined;
    return buildColumns(
      pipeMaterials,
      lock,
      assetType,
      translate,
      hasSimulation,
      units,
      translateUnit,
      formatting,
      hydraulicModel.patterns,
      hydraulicModel.curves,
      simulationSettings,
      qualityType,
      validateLabel,
      getRow,
      accessorCtx,
      allowsNullValues,
      customAttributes,
      customAttributesLock,
    );
  }, [
    assetType,
    pipeAttributesLocked,
    openPipeAttributesPaywall,
    customAttributesLocked,
    openCustomAttributesPaywall,
    pipeMaterials,
    formatting,
    hasSimulation,
    hydraulicModel.curves,
    hydraulicModel.patterns,
    labelManager,
    qualityType,
    simulationSettings,
    translate,
    translateUnit,
    units,
    accessorCtx,
    allowsNullValues,
    customAttributes,
  ]);

  const onChange = useCallback(
    async (newRows: AssetRow[]) => {
      const editableKeys = [
        ...EDITABLE_NUMERIC_KEYS[assetType],
        ...EDITABLE_SELECT_KEYS[assetType],
        ...customAttributes.map((a) => a.id),
      ];
      const moments: ModelMoment[] = [];
      const editedProperties = new Map<string, number>();
      const demandAssignments: JunctionDemandAssignment[] = [];
      const yieldIfSliceElapsed = createTimeSlicer();
      for (let i = 0; i < newRows.length; i++) {
        await yieldIfSliceElapsed();
        const newRow = newRows[i];
        const oldRow = rowsRef.current?.[i];
        // Only edited rows get a new object reference (patchRow); skipping the
        // rest keeps this O(edited) instead of O(all rows) on every commit.
        if (!oldRow || newRow === oldRow) continue;
        const assetId = newRow.id;

        if (assetType === "junction") {
          const baseDemandChanged = newRow.baseDemand !== oldRow.baseDemand;
          const patternIdChanged = newRow.patternId !== oldRow.patternId;
          if (baseDemandChanged || patternIdChanged) {
            const existing = getJunctionDemands(
              hydraulicModel.demands,
              assetId,
            );
            const rest = existing.slice(1);
            // Read the unedited field from the model so editing one of
            // base demand / pattern preserves the other (model-object rows
            // don't carry the computed value of the field that wasn't edited).
            const nextBaseDemand = baseDemandChanged
              ? ((newRow.baseDemand as number | null) ?? 0)
              : (existing[0]?.baseDemand ?? 0);
            const nextPatternId = patternIdChanged
              ? ((newRow.patternId as number | null) ?? undefined)
              : (existing[0]?.patternId ?? undefined);
            const isEmptyDefault =
              nextBaseDemand === 0 && nextPatternId === undefined;
            const newDemands =
              isEmptyDefault && rest.length === 0
                ? []
                : [
                    { baseDemand: nextBaseDemand, patternId: nextPatternId },
                    ...rest,
                  ];
            demandAssignments.push({
              junctionId: assetId,
              demands: newDemands,
            });
            if (baseDemandChanged) {
              editedProperties.set(
                "baseDemand",
                (editedProperties.get("baseDemand") ?? 0) + 1,
              );
            }
            if (patternIdChanged) {
              editedProperties.set(
                "patternId",
                (editedProperties.get("patternId") ?? 0) + 1,
              );
            }
          }
        }

        if (
          typeof newRow.label === "string" &&
          newRow.label !== oldRow.label &&
          labelManager.isLabelAvailable(newRow.label, assetType, assetId)
        ) {
          moments.push(
            changeLabel(hydraulicModel, { assetId, newLabel: newRow.label }),
          );
          editedProperties.set(
            "label",
            (editedProperties.get("label") ?? 0) + 1,
          );
        }

        if (newRow.isActive !== oldRow.isActive) {
          const op = newRow.isActive ? activateAssets : deactivateAssets;
          moments.push(op(hydraulicModel, { assetIds: [assetId] }));
          editedProperties.set(
            "isActive",
            (editedProperties.get("isActive") ?? 0) + 1,
          );
        }

        const changes: PropertyChange[] = [];
        for (const key of editableKeys) {
          if (newRow[key] !== oldRow[key]) {
            changes.push({
              property: key,
              value: newRow[key],
            } as PropertyChange);
            editedProperties.set(key, (editedProperties.get(key) ?? 0) + 1);
          }
        }
        if (assetType === "tank") {
          const curveChangeIdx = changes.findIndex(
            (c) => c.property === "volumeCurveId",
          );
          if (curveChangeIdx !== -1) {
            const [curveChange] = changes.splice(curveChangeIdx, 1);
            const curveChanges = tankVolumeCurveChanges(
              hydraulicModel.curves,
              curveChange.value as CurveId | null,
            );
            if (curveChanges) changes.push(...curveChanges);
          }
        }

        if (assetType === "pump") {
          const defTypeIdx = changes.findIndex(
            (c) => c.property === "definitionType",
          );
          if (defTypeIdx !== -1) {
            const [defTypeChange] = changes.splice(defTypeIdx, 1);
            changes.push(
              ...pumpDefinitionTypeChanges(
                defTypeChange.value as PumpDefinitionType,
              ),
            );
          }
        }

        if (assetType === "valve") {
          const kindChangeIdx = changes.findIndex((c) => c.property === "kind");
          if (kindChangeIdx !== -1) {
            const [kindChange] = changes.splice(kindChangeIdx, 1);
            changes.push(
              ...valveKindChanges(
                kindChange.value as ValveKind,
                oldRow.kind as ValveKind,
              ),
            );
          }
        }

        const sourceTypeIdx = changes.findIndex(
          (c) => c.property === "chemicalSourceType",
        );
        if (sourceTypeIdx !== -1) {
          const [sourceTypeChange] = changes.splice(sourceTypeIdx, 1);
          changes.push(
            ...chemicalSourceTypeChanges(
              sourceTypeChange.value as ChemicalSourceType | null,
            ),
          );
        }

        const normalizedChanges: PropertyChange[] = changes.map((change) =>
          change.value === null &&
          !isNullableColumn(change.property, allowsNullValues) &&
          !isCustomProperty(change.property)
            ? ({ ...change, value: undefined } as unknown as PropertyChange)
            : change,
        );

        if (normalizedChanges.length > 0) {
          moments.push(
            changeProperties(hydraulicModel, {
              assetIds: [assetId],
              changes: normalizedChanges,
            }),
          );
        }
      }

      if (demandAssignments.length > 0) {
        moments.push(changeDemandAssignment(hydraulicModel, demandAssignments));
      }

      const merged = mergeMoments(moments, "Edit asset table");
      if (merged) {
        transact(merged);
        for (const [property, count] of editedProperties) {
          if (isCustomProperty(property)) {
            const attribute = customAttributes.find(
              (attribute) => attribute.id === property,
            );
            userTracking.capture({
              name: "customAttribute.batchEdited",
              assetType,
              attributeType: attribute?.type ?? "text",
              property,
              label: attribute?.label ?? "",
              count,
            });
            continue;
          }
          userTracking.capture({
            name: "dataTables.cellEdited",
            type: assetType,
            property,
            count,
          });
        }
      }
    },
    [
      assetType,
      hydraulicModel,
      labelManager,
      transact,
      userTracking,
      allowsNullValues,
      customAttributes,
    ],
  );

  const getAssetIdsFromSortedRows = useCallback(
    (sortedRows: AssetRow[], minRow: number, maxRow: number): AssetId[] => {
      const ids: AssetId[] = [];
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
        sortedRows: AssetRow[],
      ) => {
        deleteAssetsAction(
          getAssetIdsFromSortedRows(
            sortedRows,
            selection.min.row,
            selection.max.row,
          ),
          "data-table",
        );
      },
    }),
    [translate, deleteAssetsAction, getAssetIdsFromSortedRows],
  );

  const cellContextActions = useMemo<CellContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        onSelect: (selection, sortedRows) => {
          const ids = getAssetIdsFromSortedRows(
            sortedRows as AssetRow[],
            selection.min.row,
            selection.max.row,
          );
          selectAssetsInApp(ids);
          zoomTo(USelection.fromAssetIds(ids));
          userTracking.capture({
            name: "dataTables.selectedInMap",
            type: assetType,
            source: "cell-context",
            count: ids.length,
          });
        },
      },
      ...(isEditionBlocked ? [] : [deleteAction as CellContextAction]),
    ],
    [
      translate,
      selectAssetsInApp,
      zoomTo,
      getAssetIdsFromSortedRows,
      isEditionBlocked,
      deleteAction,
      userTracking,
      assetType,
    ],
  );

  const gutterContextActions = useMemo<GutterContextAction[]>(
    () => [
      {
        label: translate("selectInMap"),
        icon: <PointerClickIcon />,
        onSelect: (selection, sortedRows) => {
          const ids = getAssetIdsFromSortedRows(
            sortedRows as AssetRow[],
            selection.min.row,
            selection.max.row,
          );
          selectAssetsInApp(ids);
          zoomTo(USelection.fromAssetIds(ids));
          userTracking.capture({
            name: "dataTables.selectedInMap",
            type: assetType,
            source: "gutter-context",
            count: ids.length,
          });
        },
      },
      ...(isEditionBlocked ? [] : [deleteAction as GutterContextAction]),
    ],
    [
      translate,
      selectAssetsInApp,
      zoomTo,
      getAssetIdsFromSortedRows,
      isEditionBlocked,
      deleteAction,
      userTracking,
      assetType,
    ],
  );

  const handleSort = useCallback(
    (columnId: string, direction: "asc" | "desc") => {
      userTracking.capture({
        name: "dataTables.sorted",
        type: assetType,
        property: columnId,
        direction,
      });
    },
    [userTracking, assetType],
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
        type: assetType,
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
    [userTracking, assetType, translate, setDialogState],
  );

  const handlePaste = useCallback(
    (info: ClipboardPasteInfo) => {
      const { requestedRows, ...tracked } = info;
      userTracking.capture({
        name: "dataTables.pasted",
        type: assetType,
        ...tracked,
      });
      // Only when a clipboard cap (`maxClipboardRows`) is set and hit — disabled today.
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
    [userTracking, assetType, translate],
  );

  return (
    <div className="flex-1 min-h-0 relative">
      {!gridReady ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <RingSpinner />
        </div>
      ) : (
        <DataGrid
          ref={dataGridRef}
          key={assetType}
          data={rows}
          columns={columns}
          onChange={onChange}
          createRow={() => ({}) as AssetRow}
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
