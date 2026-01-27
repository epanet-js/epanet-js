import {
  DynamicDataSheetGrid,
  DataSheetGridRef,
  SimpleColumn,
  Column,
} from "react-datasheet-grid";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { colors } from "src/lib/constants";
import { SpreadsheetProvider } from "./spreadsheet-context";
import { createActionsColumn, RowAction } from "./actions-column";
import { Button } from "src/components/elements";
import { AddIcon } from "src/icons";
import { setSpreadsheetActive } from "./spreadsheet-focus";

export type SpreadsheetSelectionLegacy = {
  min: { col: number; row: number };
  max: { col: number; row: number };
};

type SpreadsheetTablePropsLegacy<T extends Record<string, unknown>> = {
  data: T[];
  columns: Partial<Column<any, any, any>>[];
  onChange: (data: T[]) => void;
  createRow: () => T;
  lockRows?: boolean;
  emptyState?: React.ReactNode;
  rowActions?: RowAction[];
  addRowLabel?: string;
  gutterColumn?: boolean;
  onSelectionChange?: (selection: SpreadsheetSelectionLegacy | null) => void;
};

export type SpreadsheetTableRefLegacy = DataSheetGridRef;

export const SpreadsheetTableLegacy = forwardRef(
  function SpreadsheetTableLegacy<T extends Record<string, unknown>>(
    {
      data,
      columns,
      onChange,
      createRow,
      lockRows = false,
      emptyState,
      rowActions,
      addRowLabel,
      gutterColumn = false,
      onSelectionChange,
    }: SpreadsheetTablePropsLegacy<T>,
    ref: React.ForwardedRef<SpreadsheetTableRefLegacy>,
  ) {
    const gridRef = useRef<DataSheetGridRef>(null);
    useImperativeHandle(ref, () => gridRef.current!, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const [gridHeight, setGridHeight] = useState<number | undefined>(undefined);

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

    const handleActiveCellChange = useCallback(
      ({ cell }: { cell: { col: number; row: number } | null }) => {
        setSpreadsheetActive(cell !== null);
        // The grid blurs document.activeElement when a cell becomes active.
        // Re-focus our container so parent components can detect focus within.
        if (cell !== null) {
          containerRef.current?.focus();
        }
      },
      [],
    );

    useEffect(() => {
      return () => setSpreadsheetActive(false);
    }, []);

    useLayoutEffect(
      function resizeVertically() {
        const container = containerRef.current;
        if (!container) return;

        let lastHeight: number | undefined;

        // Button height (32px) + margin-top (8px) = 38px
        const BUTTON_SPACE = 40;

        const observer = new ResizeObserver((entries) => {
          const containerHeight = entries[0]?.contentRect.height;
          if (lastHeight === undefined || containerHeight !== lastHeight) {
            lastHeight = containerHeight;
            const newGridHeight = addRowLabel
              ? Math.max(0, containerHeight - BUTTON_SPACE)
              : containerHeight;
            setGridHeight(newGridHeight);
          }
        });
        observer.observe(container);
        return () => observer.disconnect();
      },
      [addRowLabel],
    );

    const handleChange = useCallback(
      (
        newData: T[],
        operations: { type: "UPDATE" | "DELETE" | "CREATE" }[],
      ) => {
        const isUpdateOperation = operations.some((op) => op.type === "UPDATE");
        const selection = gridRef.current?.selection;
        const numColumns = columns.length;
        const isFullRowSelected =
          selection &&
          selection.min.col === 0 &&
          selection.max.col === numColumns - 1;

        // Convert "clear full row" (UPDATE) into "delete row"
        if (isUpdateOperation && isFullRowSelected && !lockRows) {
          const minRow = selection.min.row;
          const maxRow = selection.max.row;
          onChange([...data.slice(0, minRow), ...data.slice(maxRow + 1)]);
        } else {
          onChange(newData);
        }
      },
      [data, onChange, lockRows, columns.length],
    );

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
          ref={containerRef}
          tabIndex={-1}
          className="flex flex-col justify-between h-full outline-none"
        >
          <DynamicDataSheetGrid
            ref={gridRef}
            value={data}
            onChange={handleChange}
            columns={columns}
            createRow={createRow}
            lockRows={lockRows}
            rowHeight={32}
            stickyRightColumn={rowActionsColumn}
            gutterColumn={gutterColumn ? { grow: 0 } : false}
            onActiveCellChange={handleActiveCellChange}
            onSelectionChange={({ selection }) =>
              onSelectionChange?.(selection)
            }
            className={getGridStyles(gutterColumn)}
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
            height={gridHeight}
            disableContextMenu={!!rowActions}
            disableExpandSelection
            disableSmartDelete
            addRowsComponent={
              addRowLabel ? createAddRowsComponent(addRowLabel) : false
            }
          />
        </div>
      </SpreadsheetProvider>
    );
  },
) as <T extends Record<string, unknown>>(
  props: SpreadsheetTablePropsLegacy<T> & {
    ref?: React.Ref<SpreadsheetTableRefLegacy>;
  },
) => React.ReactElement;

function AddRowButton({
  addRows,
  label,
}: {
  addRows: (count: number) => void;
  label: string;
}) {
  return (
    <Button
      variant="default"
      size="sm"
      onClick={() => addRows(1)}
      className="w-full justify-center mt-2"
    >
      <AddIcon size="sm" />
      {label}
    </Button>
  );
}

function createAddRowsComponent(label: string) {
  return (props: { addRows: (count: number) => void }) => (
    <AddRowButton addRows={props.addRows} label={label} />
  );
}

const getGridStyles = (gutterColumn: boolean) => {
  const inputStyles = [
    "[&_input]:text-sm",
    "[&_input]:w-full",
    "[&_input]:h-full",
    "[&_input]:px-2",
  ];

  const headerStyles = [
    "[&_.dsg-cell-header]:bg-[var(--spreadsheet-header-bg)]",
    "[&_.dsg-cell-header]:font-semibold",
    "[&_.dsg-cell-header-container]:truncate",
    "[&_.dsg-cell-header-container]:px-2",
  ];

  const gutterStyles = [
    "[&_.dsg-cell-gutter]:bg-[var(--spreadsheet-header-bg)]",
  ];

  const stickyColumnStyles = [
    "[&_.dsg-cell-sticky-right]:bg-white",
    "[&_.dsg-cell-header.dsg-cell-sticky-right]:bg-[var(--spreadsheet-header-bg)]",
    // Without a gutter column, the sticky right column needs transform disabled
    // to align correctly with data rows
    !gutterColumn ? "[&_.dsg-cell-sticky-right]:transform-none" : "",
  ];

  const containerStyles = [
    "[&_.dsg-container]:border-solid",
    "[&_.dsg-container]:border-y",
    "[&_.dsg-container]:border-gray-200",
    "dark:[&_.dsg-container]:border-gray-700",
  ];

  return [
    "text-sm",
    ...inputStyles,
    ...headerStyles,
    ...gutterStyles,
    ...stickyColumnStyles,
    ...containerStyles,
  ]
    .filter(Boolean)
    .join(" ");
};
