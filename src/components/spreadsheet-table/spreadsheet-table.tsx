import { DynamicDataSheetGrid, Column } from "react-datasheet-grid";
import clsx from "clsx";
import { useCallback, useMemo } from "react";

type SpreadsheetTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  onChange: (data: T[]) => void;
  createRow: () => T;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
};

export function SpreadsheetTable<T>({
  data,
  columns,
  onChange,
  createRow,
  lockRows = false,
  emptyState,
  className,
}: SpreadsheetTableProps<T>) {
  const memoizedColumns = useMemo(() => columns, [columns]);
  const memoizedCreateRow = useCallback(createRow, [createRow]);

  if (data.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <div className={clsx("spreadsheet-table", className)}>
      <DynamicDataSheetGrid
        value={data}
        onChange={(newData) => onChange(newData)}
        columns={memoizedColumns}
        createRow={memoizedCreateRow}
        lockRows={lockRows}
      />
    </div>
  );
}
