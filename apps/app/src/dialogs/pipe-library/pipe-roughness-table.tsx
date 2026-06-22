import { useMemo, useCallback, useRef } from "react";
import {
  DataGrid,
  type DataGridRef,
  type GridColumn,
  type RowAction,
  floatColumn,
} from "src/components/data-grid";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";
import type { RoughnessEntry } from "./pipe-library-dialog";

type PipeRoughnessTableProps = {
  entries: RoughnessEntry[];
  onChange: (entries: RoughnessEntry[]) => void;
};

const DEFAULT_ROW: RoughnessEntry = { age: 0, roughness: 0 };

export const PipeRoughnessTable = ({
  entries,
  onChange,
}: PipeRoughnessTableProps) => {
  const translate = useTranslate();
  const gridRef = useRef<DataGridRef>(null);

  const rowData = useMemo(
    () => (entries.length === 0 ? [{ ...DEFAULT_ROW }] : entries),
    [entries],
  );

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
    },
    [rowData, onChange],
  );

  const handleInsertRowAbove = useCallback(
    (rowIndex: number) => {
      const newRows = [
        ...rowData.slice(0, rowIndex),
        { ...DEFAULT_ROW },
        ...rowData.slice(rowIndex),
      ];
      onChange(newRows);
      selectRow(rowIndex);
    },
    [rowData, onChange, selectRow],
  );

  const handleInsertRowBelow = useCallback(
    (rowIndex: number) => {
      const newRows = [
        ...rowData.slice(0, rowIndex + 1),
        { ...DEFAULT_ROW },
        ...rowData.slice(rowIndex + 1),
      ];
      onChange(newRows);
      selectRow(rowIndex + 1);
    },
    [rowData, onChange, selectRow],
  );

  const rowActions: RowAction[] = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        variant: "destructive" as const,
        onSelect: handleDeleteRow,
        disabled: () => rowData.length <= 1,
      },
      {
        label: translate("insertRowAbove"),
        icon: <AddIcon size="sm" />,
        onSelect: handleInsertRowAbove,
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
      floatColumn("age", {
        header: translate("pipeLibrary.age"),
        size: 82,
        emptyValue: 0,
      }),
      floatColumn("roughness", {
        header: translate("pipeLibrary.roughness"),
        size: 82,
        emptyValue: 0,
      }),
    ],
    [translate],
  );

  const createRow = useCallback((): RoughnessEntry => ({ ...DEFAULT_ROW }), []);

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
    },
    [handleChange, rowData],
  );

  return (
    <div className="flex flex-col h-full py-3 pr-3">
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
