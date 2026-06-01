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
import { convertTo } from "src/quantity";
import { modelFactoriesAtom } from "src/state/model-factories";
import {
  DataGrid,
  type DataGridRef,
  type CellContextAction,
  type GutterContextAction,
  type ClipboardCopyInfo,
  type ClipboardPasteInfo,
} from "src/components/data-grid";
import { useSelectCustomerPointInApp } from "src/commands/select-customer-point-in-app";
import { useDeleteCustomerPoints } from "src/commands/delete-customer-points";
import { useUserTracking } from "src/infra/user-tracking";
import { DeleteIcon, PointerClickIcon } from "src/icons";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { useIsEditionBlocked } from "src/hooks/use-is-edition-blocked";
import { SpinnerIcon } from "src/icons";
import {
  buildCustomerPointRowsAsync,
  type CustomerPointRow,
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
    const selectCustomerPointInApp = useSelectCustomerPointInApp();
    const deleteCustomerPoints = useDeleteCustomerPoints();
    const userTracking = useUserTracking();

    const [rows, setRows] = useState<CustomerPointRow[] | null>(null);
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
        ),
      [
        translate,
        translateUnit,
        units,
        formatting,
        patternOptions,
        labelManager,
      ],
    );

    useEffect(
      function computeRows() {
        const controller = new AbortController();

        void buildCustomerPointRowsAsync(
          hydraulicModel,
          units,
          controller.signal,
        ).then((result) => {
          if (!controller.signal.aborted) setRows(result);
        });

        return () => controller.abort();
      },
      [hydraulicModel, units],
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
            const nextBaseDemandPerDay = newRow.baseDemand ?? 0;
            const nextBaseDemand = convertTo(
              {
                value: nextBaseDemandPerDay,
                unit: units.customerDemandPerDay,
              },
              units.customerDemand,
            );
            const nextPatternId = newRow.patternId ?? undefined;
            const firstDemand =
              nextBaseDemand === 0 && nextPatternId === undefined
                ? null
                : { baseDemand: nextBaseDemand, patternId: nextPatternId };
            const newDemands = firstDemand ? [firstDemand, ...rest] : rest;

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
          onSelect: (selection, sortedRows) => {
            const id = getCpIdFromRow(
              sortedRows as CustomerPointRow[],
              selection.min.row,
            );
            if (id === undefined) return;
            selectCustomerPointInApp(id);
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
        selectCustomerPointInApp,
        getCpIdFromRow,
        isEditionBlocked,
        deleteAction,
        userTracking,
      ],
    );

    const gutterContextActions = useMemo<GutterContextAction[]>(
      () => [
        {
          label: translate("selectInMap"),
          icon: <PointerClickIcon />,
          onSelect: (selection, sortedRows) => {
            const id = getCpIdFromRow(
              sortedRows as CustomerPointRow[],
              selection.min.row,
            );
            if (id === undefined) return;
            selectCustomerPointInApp(id);
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
        selectCustomerPointInApp,
        getCpIdFromRow,
        isEditionBlocked,
        deleteAction,
        userTracking,
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
          <div className="absolute inset-0 flex items-center justify-center text-subtle">
            <SpinnerIcon />
          </div>
        ) : (
          <DataGrid
            ref={dataGridRef}
            data={rows}
            columns={columns}
            onChange={onChange}
            createRow={() => ({}) as CustomerPointRow}
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
          />
        )}
      </div>
    );
  },
);
