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
import {
  CurvePoint,
  CurveType,
  stripTrailingEmptyPoints,
} from "src/hydraulic-model/curves";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { DeleteIcon, AddIcon } from "src/icons";
import { getCurveTypeConfig } from "./curve-type-config";
import type { UnitsSpec } from "src/model-metadata/quantities-spec";

type CurveRow = {
  x: number;
  y: number;
};

type CurveTableProps = {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  onSelectionChange?: (selection: GridSelection | null) => void;
  readOnly?: boolean;
  curveType?: CurveType;
  units: UnitsSpec;
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
    { points, onChange, onSelectionChange, readOnly = false, curveType, units },
    ref,
  ) {
    const translate = useTranslate();
    const translateUnit = useTranslateUnit();
    const gridRef = useRef<DataGridRef>(null);

    useImperativeHandle(ref, () => gridRef.current!, []);

    const curveConfig = getCurveTypeConfig(curveType);

    const xHeader = useMemo(() => {
      const label = translate(curveConfig.xLabel);
      const unit = curveConfig.xQuantity
        ? units[curveConfig.xQuantity]
        : undefined;
      return unit ? `${label} (${translateUnit(unit)})` : label;
    }, [
      curveConfig.xLabel,
      curveConfig.xQuantity,
      units,
      translate,
      translateUnit,
    ]);

    const yHeader = useMemo(() => {
      const label = translate(curveConfig.yLabel);
      const unit = curveConfig.yQuantity
        ? units[curveConfig.yQuantity]
        : undefined;
      return unit ? `${label} (${translateUnit(unit)})` : label;
    }, [
      curveConfig.yLabel,
      curveConfig.yQuantity,
      units,
      translate,
      translateUnit,
    ]);

    const errorCells = useMemo(() => {
      const meaningful = stripTrailingEmptyPoints(points);
      const errors = curveConfig.getErrors(meaningful);
      const set = new Set<string>();
      for (const e of errors) {
        set.add(`${e.index}:${e.value}`);
      }
      return set;
    }, [points, curveConfig]);

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
        return errorCells.has(`${rowIndex}:${columnId}`);
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
    );
  },
);
