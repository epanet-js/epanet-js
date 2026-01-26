import {
  useMemo,
  useCallback,
  forwardRef,
  useRef,
  useImperativeHandle,
} from "react";
import { keyColumn } from "react-datasheet-grid";
import {
  SpreadsheetTableLegacy,
  createFloatColumnLegacy,
  createTextReadonlyColumnLegacy,
  type SpreadsheetTableRefLegacy,
} from "src/components/spreadsheet-table";
import { PatternMultipliers } from "src/hydraulic-model/demands";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";

type PatternRow = {
  timestep: string;
  multiplier: number;
};

type PatternTableLegacyProps = {
  pattern: PatternMultipliers;
  patternTimestepSeconds: number;
  onChange: (pattern: PatternMultipliers) => void;
};

export type PatternTableRefLegacy = SpreadsheetTableRefLegacy;

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

export const PatternTableLegacy = forwardRef<
  SpreadsheetTableRefLegacy,
  PatternTableLegacyProps
>(function PatternTableLegacy(
  { pattern, patternTimestepSeconds, onChange },
  ref,
) {
  const translate = useTranslate();
  const gridRef = useRef<SpreadsheetTableRefLegacy>(null);
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

  const rowActions = useMemo(
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
      {
        ...keyColumn(
          "timestep",
          createTextReadonlyColumnLegacy({
            className: "text-gray-500 bg-gray-50",
          }),
        ),
        title: translate("timestep"),
        minWidth: 82,
      },
      {
        ...keyColumn(
          "multiplier",
          createFloatColumnLegacy({ deleteValue: DEFAULT_MULTIPLIER }),
        ),
        title: translate("multiplier"),
        minWidth: 82,
      },
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
      <SpreadsheetTableLegacy<PatternRow>
        ref={gridRef}
        data={rowData}
        columns={columns}
        onChange={handleChange}
        createRow={createRow}
        rowActions={rowActions}
        addRowLabel={translate("addTimestep")}
        gutterColumn
      />
    </div>
  );
});
