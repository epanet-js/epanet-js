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
  textReadonlyColumn,
  type DataGridRef,
  type GridSelection,
  type RowAction,
} from "src/components/data-grid";
import { PatternMultipliers } from "src/hydraulic-model/demands";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";

type PatternRow = {
  timestep: string;
  multiplier: number;
};

type PatternTableProps = {
  pattern: PatternMultipliers;
  patternTimestepSeconds: number;
  onChange: (pattern: PatternMultipliers) => void;
  onSelectionChange?: (selection: GridSelection | null) => void;
};

export type PatternTableRef = DataGridRef;

const DEFAULT_MULTIPLIER = 1.0;

function formatTimestepTime(
  timestepIndex: number,
  intervalSeconds: number,
): string {
  const totalSeconds = timestepIndex * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const toRows = (
  pattern: PatternMultipliers,
  patternTimestepSeconds: number,
): PatternRow[] => {
  if (pattern.length === 0) {
    return [
      {
        timestep: formatTimestepTime(0, patternTimestepSeconds),
        multiplier: DEFAULT_MULTIPLIER,
      },
    ];
  }
  return pattern.map((multiplier, index) => ({
    timestep: formatTimestepTime(index, patternTimestepSeconds),
    multiplier,
  }));
};

const fromRows = (rows: PatternRow[]): PatternMultipliers => {
  return rows.map((row) => row.multiplier);
};

export const PatternTable = forwardRef<DataGridRef, PatternTableProps>(
  function PatternTableTanstack(
    { pattern, patternTimestepSeconds, onChange, onSelectionChange },
    ref,
  ) {
    const translate = useTranslate();
    const gridRef = useRef<DataGridRef>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => gridRef.current!, []);

    const rowData = useMemo(
      () => toRows(pattern, patternTimestepSeconds),
      [pattern, patternTimestepSeconds],
    );

    const recalculateTimesteps = useCallback(
      (rows: PatternRow[]): PatternRow[] =>
        rows.map((row, idx) => ({
          ...row,
          timestep: formatTimestepTime(idx, patternTimestepSeconds),
        })),
      [patternTimestepSeconds],
    );

    const handleDeleteRow = useCallback(
      (rowIndex: number) => {
        if (rowData.length === 1) {
          onChange([DEFAULT_MULTIPLIER]);
        } else {
          const newRows = rowData.filter((_, i) => i !== rowIndex);
          onChange(fromRows(recalculateTimesteps(newRows)));
        }
      },
      [rowData, onChange, recalculateTimesteps],
    );

    const selectRow = useCallback((rowIndex: number) => {
      const newSelection = {
        min: { col: 0, row: rowIndex },
        max: { col: 1, row: rowIndex },
      };
      gridRef.current?.setSelection(newSelection);
    }, []);

    const handleInsertRowAbove = useCallback(
      (rowIndex: number) => {
        const newRow: PatternRow = {
          timestep: "",
          multiplier: DEFAULT_MULTIPLIER,
        };
        const newRows = [
          ...rowData.slice(0, rowIndex),
          newRow,
          ...rowData.slice(rowIndex),
        ];
        onChange(fromRows(recalculateTimesteps(newRows)));
        selectRow(rowIndex);
      },
      [rowData, onChange, recalculateTimesteps, selectRow],
    );

    const handleInsertRowBelow = useCallback(
      (rowIndex: number) => {
        const newRow: PatternRow = {
          timestep: "",
          multiplier: DEFAULT_MULTIPLIER,
        };
        const newRows = [
          ...rowData.slice(0, rowIndex + 1),
          newRow,
          ...rowData.slice(rowIndex + 1),
        ];
        onChange(fromRows(recalculateTimesteps(newRows)));
        selectRow(rowIndex + 1);
      },
      [rowData, onChange, recalculateTimesteps, selectRow],
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
        textReadonlyColumn("timestep", {
          header: translate("timestep"),
          size: 82,
        }),
        floatColumn("multiplier", {
          header: translate("multiplier"),
          size: 82,
          deleteValue: DEFAULT_MULTIPLIER,
          nullValue: 0,
        }),
      ],
      [translate],
    );

    const createRow = useCallback(
      (): PatternRow => ({
        timestep: formatTimestepTime(rowData.length, patternTimestepSeconds),
        multiplier: DEFAULT_MULTIPLIER,
      }),
      [rowData.length, patternTimestepSeconds],
    );

    const handleChange = useCallback(
      (newRows: PatternRow[]) => {
        if (newRows.length === 0) {
          onChange([DEFAULT_MULTIPLIER]);
        } else {
          onChange(fromRows(recalculateTimesteps(newRows)));
        }
      },
      [onChange, recalculateTimesteps],
    );

    return (
      <div ref={containerRef} className="h-full">
        <DataGrid<PatternRow>
          ref={gridRef}
          data={rowData}
          columns={columns}
          onChange={handleChange}
          createRow={createRow}
          rowActions={rowActions}
          addRowLabel={translate("addTimestep")}
          gutterColumn
          onSelectionChange={onSelectionChange}
          variant="spreadsheet"
        />
      </div>
    );
  },
);
