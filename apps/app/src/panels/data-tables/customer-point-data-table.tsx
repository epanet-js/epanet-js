import { memo, useCallback, useMemo, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  changeCustomerPointLabel,
  changeDemandAssignment,
  mergeMoments,
} from "src/hydraulic-model/model-operations";
import { getCustomerPointDemands, type ModelMoment } from "src/hydraulic-model";
import type { CustomerDemandAssignment } from "src/hydraulic-model/model-operation";
import { createTimeSlicer } from "src/infra/yield-to-main";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  PerformantDataGrid,
  type DataGridRef,
  type CellContextAction,
  type GutterContextAction,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  patchModelRow,
} from "src/components/data-grid";
import { useSelectCustomerPointsInApp } from "src/commands/select-customer-points-in-app";
import { useDeleteCustomerPoints } from "src/commands/delete-customer-points";
import { useUserTracking } from "src/infra/user-tracking";
import { DeleteIcon, PointerClickIcon } from "src/icons";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { customerPointsVisibleAtom } from "src/state/map-symbology";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { RingSpinner } from "src/components/ring-spinner";
import {
  buildCustomerPointModelRows,
  type CustomerPointRow,
  type CpAccessorCtx,
} from "./customer-point-data-table-data";
import { buildCustomerPointColumns } from "./customer-point-data-table-columns";
import { useDeferredGridMount } from "./use-deferred-grid-mount";

export const CustomerPointDataTable = memo(
  function CustomerPointDataTableInner() {
    const dataGridRef = useRef<DataGridRef>(null);
    const setDialogState = useSetAtom(dialogAtom);
    const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
    const { patterns } = hydraulicModel;
    const { units, formatting } = useAtomValue(projectSettingsAtom);
    const { labelManager } = useAtomValue(modelFactoriesAtom);
    const { transact } = useModelTransaction();
    const translate = useTranslate();
    const translateUnit = useTranslateUnit();
    const isEditionBlocked = useIsEditionBlocked();
    const customerPointsVisible = useAtomValue(customerPointsVisibleAtom);
    const selectCustomerPointsInApp = useSelectCustomerPointsInApp();
    const deleteCustomerPoints = useDeleteCustomerPoints();
    const userTracking = useUserTracking();

    const rows = useMemo(
      () => buildCustomerPointModelRows(hydraulicModel),
      [hydraulicModel],
    );
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    // Defer mounting the grid so switching tabs stays responsive.
    const gridReady = useDeferredGridMount();

    const patternOptions = useMemo(() => {
      const options: { value: number; label: string }[] = [];
      for (const [patternId, { label, type }] of patterns.entries()) {
        if (type === "demand") {
          options.push({ value: patternId, label });
        }
      }
      return options;
    }, [patterns]);

    const accessorCtx = useMemo<CpAccessorCtx>(
      () => ({ model: hydraulicModel, units }),
      [hydraulicModel, units],
    );

    const columns = useMemo(
      () =>
        buildCustomerPointColumns(
          translate,
          translateUnit,
          units,
          formatting,
          patternOptions,
          (label, row) => {
            const cpId = row.id;
            if (cpId === undefined) return true;
            return labelManager.isLabelAvailable(label, "customerPoint", cpId);
          },
          accessorCtx,
        ),
      [
        translate,
        translateUnit,
        units,
        formatting,
        patternOptions,
        labelManager,
        accessorCtx,
      ],
    );

    const onChange = useCallback(
      async (newRows: CustomerPointRow[]) => {
        const moments: ModelMoment[] = [];
        const demandAssignments: CustomerDemandAssignment[] = [];
        let labelChanges = 0;
        let oldDemandsTotal = 0;
        let newDemandsTotal = 0;

        const yieldIfSliceElapsed = createTimeSlicer();
        for (let i = 0; i < newRows.length; i++) {
          await yieldIfSliceElapsed();
          const newRow = newRows[i];
          const oldRow = rowsRef.current?.[i];
          // Only edited rows get a new object reference (patchRow); skipping the
          // rest keeps this O(edited) instead of O(all rows) on every commit.
          if (!oldRow || newRow === oldRow) continue;

          if (
            typeof newRow.label === "string" &&
            newRow.label !== oldRow.label &&
            labelManager.isLabelAvailable(
              newRow.label,
              "customerPoint",
              newRow.id,
            )
          ) {
            moments.push(
              changeCustomerPointLabel(hydraulicModel, {
                customerPointId: newRow.id,
                newLabel: newRow.label,
              }),
            );
            labelChanges += 1;
          }

          const baseDemandChanged = newRow.baseDemand !== oldRow.baseDemand;
          const patternIdChanged = newRow.patternId !== oldRow.patternId;
          if (baseDemandChanged || patternIdChanged) {
            const existing = getCustomerPointDemands(
              hydraulicModel.demands,
              newRow.id,
            );
            const rest = existing.slice(1);
            const nextBaseDemand = baseDemandChanged
              ? (newRow.baseDemand ?? 0) // Unit conversion handled by the cell
              : (existing[0]?.baseDemand ?? 0);
            const nextPatternId = patternIdChanged
              ? (newRow.patternId ?? undefined)
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
              customerPointId: newRow.id,
              demands: newDemands,
            });
            oldDemandsTotal += existing.length;
            newDemandsTotal += newDemands.length;
          }
        }

        if (demandAssignments.length > 0) {
          moments.push(
            changeDemandAssignment(hydraulicModel, demandAssignments),
          );
        }

        const merged = mergeMoments(moments, "Edit customer points");
        if (!merged) return;
        transact(merged);

        if (labelChanges > 0) {
          userTracking.capture({
            name: "customerPointActions.labelChanged",
            count: labelChanges,
          });
        }
        if (demandAssignments.length > 0) {
          userTracking.capture({
            name: "customerPointDemands.edited",
            oldCount: oldDemandsTotal,
            newCount: newDemandsTotal,
          });
        }
      },
      [hydraulicModel, labelManager, transact, userTracking],
    );

    const getCpIdsFromRange = useCallback(
      (sortedRows: CustomerPointRow[], minRow: number, maxRow: number) => {
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
          sortedRows: CustomerPointRow[],
        ) => {
          deleteCustomerPoints(
            getCpIdsFromRange(sortedRows, selection.min.row, selection.max.row),
            "data-table",
          );
        },
      }),
      [translate, deleteCustomerPoints, getCpIdsFromRange],
    );

    const cellContextActions = useMemo<CellContextAction[]>(
      () => [
        {
          label: translate("selectInMap"),
          icon: <PointerClickIcon />,
          disabled: () => !customerPointsVisible,
          onSelect: (selection, sortedRows) => {
            const ids = getCpIdsFromRange(
              sortedRows as CustomerPointRow[],
              selection.min.row,
              selection.max.row,
            );
            if (ids.length === 0) return;
            selectCustomerPointsInApp(ids);
            userTracking.capture({
              name: "dataTables.selectedInMap",
              type: "customerPoint",
              source: "cell-context",
              count: ids.length,
            });
          },
        },
        ...(isEditionBlocked ? [] : [deleteAction as CellContextAction]),
      ],
      [
        translate,
        selectCustomerPointsInApp,
        getCpIdsFromRange,
        isEditionBlocked,
        deleteAction,
        userTracking,
        customerPointsVisible,
      ],
    );

    const gutterContextActions = useMemo<GutterContextAction[]>(
      () => [
        {
          label: translate("selectInMap"),
          icon: <PointerClickIcon />,
          disabled: () => !customerPointsVisible,
          onSelect: (selection, sortedRows) => {
            const ids = getCpIdsFromRange(
              sortedRows as CustomerPointRow[],
              selection.min.row,
              selection.max.row,
            );
            if (ids.length === 0) return;
            selectCustomerPointsInApp(ids);
            userTracking.capture({
              name: "dataTables.selectedInMap",
              type: "customerPoint",
              source: "gutter-context",
              count: ids.length,
            });
          },
        },
        ...(isEditionBlocked ? [] : [deleteAction as GutterContextAction]),
      ],
      [
        translate,
        selectCustomerPointsInApp,
        getCpIdsFromRange,
        isEditionBlocked,
        deleteAction,
        userTracking,
        customerPointsVisible,
      ],
    );

    const handleSort = useCallback(
      (columnId: string, direction: "asc" | "desc") => {
        userTracking.capture({
          name: "dataTables.sorted",
          type: "customerPoint",
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
          type: "customerPoint",
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
          type: "customerPoint",
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
      [userTracking, translate],
    );

    return (
      <div className="flex-1 min-h-0 relative">
        {!gridReady ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <RingSpinner />
          </div>
        ) : (
          <PerformantDataGrid
            ref={dataGridRef}
            data={rows}
            columns={columns}
            onChange={onChange}
            createRow={() => ({}) as CustomerPointRow}
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
  },
);
