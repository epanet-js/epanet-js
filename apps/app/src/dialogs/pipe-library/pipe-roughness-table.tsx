import { useMemo, useCallback, useRef, useEffect } from "react";
import {
  DataGrid,
  type DataGridRef,
  type GridColumn,
  type RowAction,
  floatColumn,
  integerColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { useUserTracking } from "src/infra/user-tracking";
import { DeleteIcon, AddIcon } from "src/icons";
import type { RoughnessEntry } from "@epanet-js/pipe-library";

type PipeRoughnessTableProps = {
  entries: RoughnessEntry[];
  onChange: (entries: RoughnessEntry[]) => void;
};

const DEFAULT_ROW: RoughnessEntry = { age: null, roughness: null };

const YEARS_BETWEEN_NEW_ROWS = 10;
export const PipeRoughnessTable = ({
  entries,
  onChange,
}: PipeRoughnessTableProps) => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const gridRef = useRef<DataGridRef>(null);

  const rowData = useMemo(
    () => (entries.length === 0 ? [{ ...DEFAULT_ROW }] : entries),
    [entries],
  );

  useEffect(() => {
    const sorted = sortByAge(entries);
    if (sorted.some((entry, i) => entry !== entries[i])) {
      onChange(sorted);
    }
  }, [entries, onChange]);

  const selectRow = useCallback((rowIndex: number) => {
    gridRef.current?.selectCells({ rowIndex });
  }, []);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      if (rowData.length === 1) {
        onChange([{ ...DEFAULT_ROW }]);
      } else {
        onChange(rowData.filter((_, i) => i !== rowIndex));
      }
      userTracking.capture({
        name: "pipeLibrary.roughnessRow.changed",
        action: "deleted",
      });
    },
    [rowData, onChange, userTracking],
  );

  const newRowAfter = useCallback(
    (rowIndex: number): RoughnessEntry => {
      const ref = rowData[rowIndex];
      if (ref?.age != null && ref?.roughness != null) {
        return {
          age: ref.age + YEARS_BETWEEN_NEW_ROWS,
          roughness: ref.roughness,
        };
      }
      return { ...DEFAULT_ROW };
    },
    [rowData],
  );

  const handleInsertRowAbove = useCallback(
    (rowIndex: number) => {
      const newRows = [
        ...rowData.slice(0, rowIndex),
        newRowAfter(rowIndex - 1),
        ...rowData.slice(rowIndex),
      ];
      onChange(newRows);
      selectRow(rowIndex);
      userTracking.capture({
        name: "pipeLibrary.roughnessRow.changed",
        action: "insertedAbove",
      });
    },
    [rowData, onChange, selectRow, newRowAfter, userTracking],
  );

  const handleInsertRowBelow = useCallback(
    (rowIndex: number) => {
      const newRows = [
        ...rowData.slice(0, rowIndex + 1),
        newRowAfter(rowIndex),
        ...rowData.slice(rowIndex + 1),
      ];
      onChange(newRows);
      selectRow(rowIndex + 1);
      userTracking.capture({
        name: "pipeLibrary.roughnessRow.changed",
        action: "insertedBelow",
      });
    },
    [rowData, onChange, selectRow, newRowAfter, userTracking],
  );

  const rowActions: RowAction[] = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        variant: "destructive" as const,
        onSelect: handleDeleteRow,
        disabled: (rowIndex: number) => rowIndex === 0 || rowData.length <= 1,
      },
      {
        label: translate("insertRowAbove"),
        icon: <AddIcon size="sm" />,
        onSelect: handleInsertRowAbove,
        disabled: (rowIndex: number) => rowIndex === 0,
      },
      {
        label: translate("insertRowBelow"),
        icon: <AddIcon size="sm" />,
        onSelect: handleInsertRowBelow,
      },
    ],
    [
      translate,
      handleDeleteRow,
      handleInsertRowAbove,
      handleInsertRowBelow,
      rowData.length,
    ],
  );

  const columns: GridColumn<RoughnessEntry>[] = useMemo(
    () => [
      integerColumn("age", {
        header: translate("pipeLibrary.age"),
        size: 82,
        emptyValue: null,
        isReadOnly: (rowIndex: number) => rowIndex === 0,
      }),
      floatColumn("roughness", {
        header: translate("pipeLibrary.roughness"),
        size: 82,
        emptyValue: 0,
      }),
    ],
    [translate],
  );

  const createRow = useCallback(
    (): RoughnessEntry => newRowAfter(rowData.length - 1),
    [newRowAfter, rowData.length],
  );

  const handleChange = useCallback(
    (newRows: RoughnessEntry[]) => {
      onChange(newRows.length === 0 ? [{ ...DEFAULT_ROW }] : newRows);
    },
    [onChange],
  );

  const handleDelete = useCallback(
    (rowsToDelete: RoughnessEntry[]) => {
      const toRemove = new Set(rowsToDelete);
      handleChange(rowData.filter((row) => !toRemove.has(row)));
      userTracking.capture({
        name: "pipeLibrary.roughnessRow.changed",
        action: "deleted",
      });
    },
    [handleChange, rowData, userTracking],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 py-3 pr-3">
      <DataGrid<RoughnessEntry>
        ref={gridRef}
        data={rowData}
        columns={columns}
        onChange={handleChange}
        onDelete={handleDelete}
        createRow={createRow}
        rowActions={rowActions}
        addRowLabel={translate("pipeLibrary.addEntry")}
        gutterColumn="numbered"
        variant="spreadsheet"
        autoAddNewRows
      />
    </div>
  );
};

const sortByAge = (rows: RoughnessEntry[]): RoughnessEntry[] =>
  [...rows].sort((a, b) => {
    if (a.age === null && b.age === null) return 0;
    if (a.age === null) return 1;
    if (b.age === null) return -1;
    return a.age - b.age;
  });
