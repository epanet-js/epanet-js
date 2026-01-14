import {
  DynamicDataSheetGrid,
  Column,
  DataSheetGridRef,
  SimpleColumn,
} from "react-datasheet-grid";
import { useCallback, useMemo, useRef } from "react";
import { colors } from "src/lib/constants";
import { SpreadsheetProvider } from "./spreadsheet-context";
import { createActionsColumn, RowAction } from "./actions-column";
import { Button } from "src/components/elements";
import { AddIcon } from "src/icons";

type SpreadsheetTableProps<T extends Record<string, unknown>> = {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Partial<Column<T, any, any>>[];
  onChange: (data: T[]) => void;
  createRow: () => T;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
  rowActions?: RowAction[];
  height?: number;
  addRowLabel?: string;
};

export function SpreadsheetTable<T extends Record<string, unknown>>({
  data,
  columns,
  onChange,
  createRow,
  lockRows = false,
  emptyState,
  rowActions,
  height,
  addRowLabel,
}: SpreadsheetTableProps<T>) {
  const gridRef = useRef<DataSheetGridRef>(null);
  const memoizedColumns = useMemo(() => columns, [columns]);
  const memoizedCreateRow = useCallback(createRow, [createRow]);

  const rowActionsColumn = useMemo(
    () =>
      rowActions
        ? (createActionsColumn(rowActions) as SimpleColumn<T, unknown>)
        : undefined,
    [rowActions],
  );

  const setActiveCell = useCallback((cell: { col: number; row: number }) => {
    gridRef.current?.setActiveCell(cell);
  }, []);

  const contextValue = useMemo(() => ({ setActiveCell }), [setActiveCell]);

  const handleAddRow = useCallback(() => {
    const newRow = createRow();
    onChange([...data, newRow]);
  }, [createRow, onChange, data]);

  if (data.length === 0 && emptyState) {
    return (
      <SpreadsheetProvider value={contextValue}>
        {emptyState}
      </SpreadsheetProvider>
    );
  }

  return (
    <SpreadsheetProvider value={contextValue}>
      <DynamicDataSheetGrid
        ref={gridRef}
        value={data}
        onChange={(newData) => onChange(newData)}
        columns={memoizedColumns}
        createRow={memoizedCreateRow}
        lockRows={lockRows}
        rowHeight={32}
        stickyRightColumn={rowActionsColumn}
        gutterColumn={false}
        className="text-sm [&_input]:text-sm [&_input]:w-full [&_input]:h-full [&_input]:px-2 [&_.dsg-cell-sticky-right]:transform-none [&_.dsg-cell-header]:bg-[var(--spreadsheet-header-bg)] [&_.dsg-cell-header]:font-semibold [&_.dsg-cell-sticky-right]:bg-[var(--spreadsheet-header-bg)]"
        style={
          {
            "--dsg-selection-border-color": colors.purple500,
            "--dsg-selection-border-width": "1px",
            "--dsg-selection-background-color": `${colors.purple300}1a`,
            "--dsg-header-text-color": colors.gray600,
            "--dsg-header-active-text-color": colors.gray600,
            "--spreadsheet-header-bg": colors.gray100,
          } as React.CSSProperties
        }
        height={height}
        disableContextMenu={!!rowActions}
        disableExpandSelection={true}
        addRowsComponent={false}
      />
      {addRowLabel && (
        <Button
          variant="default"
          size="sm"
          onClick={handleAddRow}
          className="w-full justify-center"
        >
          <AddIcon size="sm" />
          {addRowLabel}
        </Button>
      )}
    </SpreadsheetProvider>
  );
}
