import {
  DynamicDataSheetGrid,
  Column,
  DataSheetGridRef,
} from "react-datasheet-grid";
import { useCallback, useMemo, useRef } from "react";
import { colors } from "src/lib/constants";
import { SpreadsheetProvider } from "./spreadsheet-context";

type SpreadsheetTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  onChange: (data: T[]) => void;
  createRow: () => T;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
};

export function SpreadsheetTable<T>({
  data,
  columns,
  onChange,
  createRow,
  lockRows = false,
  emptyState,
}: SpreadsheetTableProps<T>) {
  const gridRef = useRef<DataSheetGridRef>(null);
  const memoizedColumns = useMemo(() => columns, [columns]);
  const memoizedCreateRow = useCallback(createRow, [createRow]);

  const setActiveCell = useCallback((cell: { col: number; row: number }) => {
    gridRef.current?.setActiveCell(cell);
  }, []);

  const contextValue = useMemo(() => ({ setActiveCell }), [setActiveCell]);

  if (data.length === 0 && emptyState) {
    return (
      <SpreadsheetProvider value={contextValue}>
        {emptyState}
      </SpreadsheetProvider>
    );
  }

  return (
    <SpreadsheetProvider value={contextValue}>
      <div
        className="text-sm [&_input]:text-sm [&_input]:w-full [&_input]:h-full [&_input]:px-2"
        style={
          {
            "--dsg-selection-border-color": colors.purple500,
            "--dsg-selection-border-width": "1px",
            "--dsg-selection-background-color": `${colors.purple300}1a`,
          } as React.CSSProperties
        }
      >
        <DynamicDataSheetGrid
          ref={gridRef}
          value={data}
          onChange={(newData) => onChange(newData)}
          columns={memoizedColumns}
          createRow={memoizedCreateRow}
          lockRows={lockRows}
          rowHeight={38}
        />
      </div>
    </SpreadsheetProvider>
  );
}
