import {
  useMemo,
  useCallback,
  forwardRef,
  useRef,
  useImperativeHandle,
} from "react";
import {
  floatColumn,
  DataGrid,
  type DataGridRef,
  type GridSelection,
  type RowAction,
} from "src/components/data-grid";
import { CurvePoint } from "src/hydraulic-model/curves";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";

type CurveRow = {
  x: number;
  y: number;
};

type CurveTableProps = {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  onSelectionChange?: (selection: GridSelection | null) => void;
  readOnly?: boolean;
  errorCells?: Set<string>;
  xHeader: string;
  yHeader: string;
};

export type CurveTableRef = DataGridRef;

const DEFAULT_X = 0;
const DEFAULT_Y = 0;

const toRows = (points: CurvePoint[]): CurveRow[] => {
  if (points.length === 0) {
    return [{ x: DEFAULT_X, y: DEFAULT_Y }];
  }
  return points.map((point) => ({
    x: point.x,
    y: point.y,
  }));
};

export const CurveTable = forwardRef<DataGridRef, CurveTableProps>(
  function CurveTable(
    {
      points,
      onChange,
      onSelectionChange,
      readOnly = false,
      errorCells,
      xHeader,
      yHeader,
    },
    ref,
  ) {
    const translate = useTranslate();
    const gridRef = useRef<DataGridRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => gridRef.current!, []);

    const rowData = useMemo(() => toRows(points), [points]);

    const handleDeleteRow = useCallback(
      (rowIndex: number) => {
        if (rowData.length === 1) {
          onChange([{ x: DEFAULT_X, y: DEFAULT_Y }]);
        } else {
          const newRows = rowData.filter((_, i) => i !== rowIndex);
          onChange(newRows);
        }
      },
      [rowData, onChange],
    );

    const selectRow = useCallback((rowIndex: number) => {
      gridRef.current?.selectCells({ rowIndex });
    }, []);

    const handleInsertRowAbove = useCallback(
      (rowIndex: number) => {
        const sourceRow = rowData[rowIndex];
        const newRow: CurveRow = { ...sourceRow };
        const newRows = [
          ...rowData.slice(0, rowIndex),
          newRow,
          ...rowData.slice(rowIndex),
        ];
        onChange(newRows);
        selectRow(rowIndex);
      },
      [rowData, onChange, selectRow],
    );

    const handleInsertRowBelow = useCallback(
      (rowIndex: number) => {
        const sourceRow = rowData[rowIndex];
        const newRow: CurveRow = { ...sourceRow };
        const newRows = [
          ...rowData.slice(0, rowIndex + 1),
          newRow,
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

    const columns = useMemo(
      () => [
        floatColumn("x", {
          header: xHeader,
          size: 82,
          deleteValue: DEFAULT_X,
          nullValue: 0,
        }),
        floatColumn("y", {
          header: yHeader,
          size: 82,
          deleteValue: DEFAULT_Y,
          nullValue: 0,
        }),
      ],
      [xHeader, yHeader],
    );

    const createRow = useCallback(
      (): CurveRow => ({
        x: DEFAULT_X,
        y: DEFAULT_Y,
      }),
      [],
    );

    const cellHasWarning = useCallback(
      (rowIndex: number, columnId: string) => {
        return errorCells?.has(`${rowIndex}:${columnId}`) ?? false;
      },
      [errorCells],
    );

    const handleChange = useCallback(
      (newRows: CurveRow[]) => {
        if (newRows.length === 0) {
          onChange([{ x: DEFAULT_X, y: DEFAULT_Y }]);
        } else {
          onChange(newRows);
        }
      },
      [onChange],
    );

    return (
      <div ref={containerRef} className="h-full">
        <DataGrid<CurveRow>
          ref={gridRef}
          data={rowData}
          columns={columns}
          onChange={handleChange}
          createRow={createRow}
          rowActions={rowActions}
          addRowLabel={translate("addPoint")}
          gutterColumn
          onSelectionChange={onSelectionChange}
          variant="spreadsheet"
          readOnly={readOnly}
          cellHasWarning={cellHasWarning}
          autoAddNewRows
        />
      </div>
    );
  },
);
