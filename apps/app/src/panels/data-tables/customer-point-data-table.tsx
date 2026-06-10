import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import {
  changeCustomerPointLabel,
  changeDemandAssignment,
} from "src/hydraulic-model/model-operations";
import { getCustomerPointDemands } from "src/hydraulic-model";
import type { CustomerDemandAssignment } from "src/hydraulic-model/model-operation";
import { convertTo } from "@epanet-js/quantity";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  DataGrid,
  type DataGridRef,
  type CellContextAction,
  type GutterContextAction,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
  patchModelRow,
} from "src/components/data-grid";
import { useSelectCustomerPointInApp } from "src/commands/select-customer-point-in-app";
import { useSelectCustomerPointsInApp } from "src/commands/select-customer-points-in-app";
import { useDeleteCustomerPoints } from "src/commands/delete-customer-points";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
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
  buildCustomerPointRowsAsync,
  buildCustomerPointModelRows,
  type CustomerPointRow,
  type CpAccessorCtx,
} from "./customer-point-data-table-data";
import { buildCustomerPointColumns } from "./customer-point-data-table-columns";

export const CustomerPointDataTable = memo(
  function CustomerPointDataTableInner() {
    const dataGridRef = useRef<DataGridRef>(null);
    const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
    const { patterns } = hydraulicModel;
    const { units, formatting } = useAtomValue(projectSettingsAtom);
    const { labelManager } = useAtomValue(modelFactoriesAtom);
    const { transact } = useModelTransaction();
    const translate = useTranslate();
    const translateUnit = useTranslateUnit();
    const isEditionBlocked = useIsEditionBlocked();
    const customerPointsVisible = useAtomValue(customerPointsVisibleAtom);
    const selectCustomerPointInApp = useSelectCustomerPointInApp();
    const selectCustomerPointsInApp = useSelectCustomerPointsInApp();
    const isMultiCpSelectionOn = useFeatureFlag("FLAG_MULTI_CP_SELECTION");
    const isPerfOn = useFeatureFlag("FLAG_DATA_TABLES_PERFORMANCE");
    const deleteCustomerPoints = useDeleteCustomerPoints();
    const userTracking = useUserTracking();

    const [legacyRows, setLegacyRows] = useState<CustomerPointRow[] | null>(
      null,
    );
    const modelRows = useMemo(
      () => (isPerfOn ? buildCustomerPointModelRows(hydraulicModel) : null),
      [isPerfOn, hydraulicModel],
    );
    const rows = isPerfOn ? modelRows : legacyRows;
    const rowsRef = useRef(rows);
    rowsRef.current = rows;

    const patternOptions = useMemo(() => {
      const options: { value: number; label: string }[] = [];
      for (const [patternId, { label, type }] of patterns.entries()) {
        if (type === "demand") {
          options.push({ value: patternId, label });
        }
      }
      return options;
    }, [patterns]);

    const accessorCtx = useMemo<CpAccessorCtx | undefined>(
      () => (isPerfOn ? { model: hydraulicModel, units } : undefined),
      [isPerfOn, hydraulicModel, units],
    );

    const columns = useMemo(
      () =>
        buildCustomerPointColumns(
          translate,
          translateUnit,
          units,
          formatting,
          patternOptions,
          (label: string, rowIndex: number) => {
            const cpId = rowsRef.current?.[rowIndex]?.id;
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

    useEffect(
      function computeRows() {
        if (isPerfOn) return;
        const controller = new AbortController();

        void buildCustomerPointRowsAsync(
          hydraulicModel,
          units,
          controller.signal,
        ).then((result) => {
          if (!controller.signal.aborted) setLegacyRows(result);
        });

        return () => controller.abort();
      },
      [isPerfOn, hydraulicModel, units],
    );

    const onChange = useCallback(
      (newRows: CustomerPointRow[]) => {
        const demandAssignments: CustomerDemandAssignment[] = [];
        let oldDemandsTotal = 0;
        let newDemandsTotal = 0;

        for (let i = 0; i < newRows.length; i++) {
          const newRow = newRows[i];
          const oldRow = rowsRef.current?.[i];
          if (!oldRow) continue;

          if (
            typeof newRow.label === "string" &&
            newRow.label !== oldRow.label &&
            labelManager.isLabelAvailable(
              newRow.label,
              "customerPoint",
              newRow.id,
            )
          ) {
            const moment = changeCustomerPointLabel(hydraulicModel, {
              customerPointId: newRow.id,
              newLabel: newRow.label,
            });
            transact(moment);
            userTracking.capture({
              name: "customerPointActions.labelChanged",
              oldLabel: oldRow.label,
              newLabel: newRow.label,
            });
          }

          const baseDemandChanged = newRow.baseDemand !== oldRow.baseDemand;
          const patternIdChanged = newRow.patternId !== oldRow.patternId;
          if (baseDemandChanged || patternIdChanged) {
            const existing = getCustomerPointDemands(
              hydraulicModel.demands,
              newRow.id,
            );
            const rest = existing.slice(1);
            // Read the unedited field from the model so editing one of base
            // demand / pattern preserves the other (model-object rows don't
            // carry the computed value of the field that wasn't edited).
            const nextBaseDemand = baseDemandChanged
              ? convertTo(
                  {
                    value: newRow.baseDemand ?? 0,
                    unit: units.customerDemandPerDay,
                  },
                  units.customerDemand,
                )
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
          const moment = changeDemandAssignment(
            hydraulicModel,
            demandAssignments,
          );
          transact(moment);
          userTracking.capture({
            name: "customerPointDemands.edited",
            oldCount: oldDemandsTotal,
            newCount: newDemandsTotal,
          });
        }
      },
      [hydraulicModel, units, labelManager, transact, userTracking],
    );

    const getCpIdFromRow = useCallback(
      (sortedRows: CustomerPointRow[], rowIndex: number) =>
        sortedRows[rowIndex]?.id,
      [],
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
          onSelect: (selection, sortedRows, originCell) => {
            if (isMultiCpSelectionOn) {
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
              return;
            }
            const id = getCpIdFromRow(
              sortedRows as CustomerPointRow[],
              originCell.row,
            );
            if (id === undefined) return;
            selectCustomerPointInApp(id);
            dataGridRef.current?.selectCells({
              colIndex: originCell.col,
              rowIndex: originCell.row,
            });
            userTracking.capture({
              name: "dataTables.selectedInMap",
              type: "customerPoint",
              source: "cell-context",
              count: 1,
            });
          },
        },
        ...(isEditionBlocked ? [] : [deleteAction as CellContextAction]),
      ],
      [
        translate,
        isMultiCpSelectionOn,
        selectCustomerPointInApp,
        selectCustomerPointsInApp,
        getCpIdFromRow,
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
          onSelect: (selection, sortedRows, originRowIndex) => {
            if (isMultiCpSelectionOn) {
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
              return;
            }
            const id = getCpIdFromRow(
              sortedRows as CustomerPointRow[],
              originRowIndex,
            );
            if (id === undefined) return;
            selectCustomerPointInApp(id);
            dataGridRef.current?.selectCells({ rowIndex: originRowIndex });
            userTracking.capture({
              name: "dataTables.selectedInMap",
              type: "customerPoint",
              source: "gutter-context",
              count: 1,
            });
          },
        },
        ...(isEditionBlocked ? [] : [deleteAction as GutterContextAction]),
      ],
      [
        translate,
        isMultiCpSelectionOn,
        selectCustomerPointInApp,
        selectCustomerPointsInApp,
        getCpIdFromRow,
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
        const { rows, cols, allRows, allCols, columnIds } = info;
        userTracking.capture({
          name: "dataTables.copied",
          type: "customerPoint",
          rows,
          cols,
          allRows,
          allCols,
          withHeaders: false,
          columnIds,
        });

        if (allRows) {
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
                userTracking.capture({
                  name: "dataTables.copied",
                  type: "customerPoint",
                  rows,
                  cols,
                  allRows,
                  allCols,
                  withHeaders: true,
                  columnIds,
                });
              },
            },
          });
        }
      },
      [userTracking, translate],
    );

    const handlePaste = useCallback(
      (info: ClipboardPasteInfo) => {
        userTracking.capture({
          name: "dataTables.pasted",
          type: "customerPoint",
          ...info,
        });
      },
      [userTracking],
    );

    return (
      <div className="flex-1 min-h-0 relative">
        {rows === null ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <RingSpinner />
          </div>
        ) : (
          <DataGrid
            ref={dataGridRef}
            data={rows}
            columns={columns}
            onChange={onChange}
            createRow={() => ({}) as CustomerPointRow}
            getRowId={(row) => String(row.id)}
            patchRow={isPerfOn ? patchModelRow : undefined}
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
