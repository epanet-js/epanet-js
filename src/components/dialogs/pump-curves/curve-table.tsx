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
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { DeleteIcon, AddIcon } from "src/icons";
import { Unit } from "src/quantity";

type CurveRow = {
  flow: number;
  head: number;
};

type CurveTableProps = {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  onSelectionChange?: (selection: GridSelection | null) => void;
  readOnly?: boolean;
  errorCells?: Set<string>;
  flowUnit: Unit;
  headUnit: Unit;
};

export type CurveTableRef = DataGridRef;

const DEFAULT_FLOW = 0;
const DEFAULT_HEAD = 0;

const toRows = (points: CurvePoint[]): CurveRow[] => {
  if (points.length === 0) {
    return [{ flow: DEFAULT_FLOW, head: DEFAULT_HEAD }];
  }
  return points.map((point) => ({
    flow: point.x,
    head: point.y,
  }));
};

const fromRows = (rows: CurveRow[]): CurvePoint[] => {
  return rows.map((row) => ({
    x: row.flow,
    y: row.head,
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
      flowUnit,
      headUnit,
    },
    ref,
  ) {
    const translate = useTranslate();
    const translateUnit = useTranslateUnit();
    const gridRef = useRef<DataGridRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => gridRef.current!, []);

    const rowData = useMemo(() => toRows(points), [points]);

    const handleDeleteRow = useCallback(
      (rowIndex: number) => {
        if (rowData.length === 1) {
          onChange([{ x: DEFAULT_FLOW, y: DEFAULT_HEAD }]);
        } else {
          const newRows = rowData.filter((_, i) => i !== rowIndex);
          onChange(fromRows(newRows));
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
        onChange(fromRows(newRows));
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
        onChange(fromRows(newRows));
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

    const columns = useMemo(() => {
      const flowHeader = flowUnit
        ? `${translate("flow")} (${translateUnit(flowUnit)})`
        : translate("flow");
      const headHeader = headUnit
        ? `${translate("head")} (${translateUnit(headUnit)})`
        : translate("head");
      return [
        floatColumn("flow", {
          header: flowHeader,
          size: 82,
          deleteValue: DEFAULT_FLOW,
          nullValue: 0,
        }),
        floatColumn("head", {
          header: headHeader,
          size: 82,
          deleteValue: DEFAULT_HEAD,
          nullValue: 0,
        }),
      ];
    }, [flowUnit, headUnit, translate, translateUnit]);

    const createRow = useCallback(
      (): CurveRow => ({
        flow: DEFAULT_FLOW,
        head: DEFAULT_HEAD,
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
          onChange([{ x: DEFAULT_FLOW, y: DEFAULT_HEAD }]);
        } else {
          onChange(fromRows(newRows));
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
