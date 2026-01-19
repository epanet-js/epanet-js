import { useMemo, useCallback } from "react";
import { keyColumn, Column } from "react-datasheet-grid";
import {
  SpreadsheetTable,
  createFloatColumn,
  createTextReadonlyColumn,
} from "src/components/spreadsheet-table";
import { DemandPattern } from "src/hydraulic-model/demands";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";

type PatternRow = {
  timestep: string;
  multiplier: number;
};

type PatternTableProps = {
  pattern: DemandPattern;
  patternTimestepSeconds: number;
  onChange: (pattern: DemandPattern) => void;
};

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
  pattern: DemandPattern,
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

const fromRows = (rows: PatternRow[]): DemandPattern => {
  return rows.map((row) => row.multiplier);
};

export const PatternTable = ({
  pattern,
  patternTimestepSeconds,
  onChange,
}: PatternTableProps) => {
  const translate = useTranslate();

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
        // Reset to default instead of deleting the last row
        onChange([DEFAULT_MULTIPLIER]);
      } else {
        const newRows = rowData.filter((_, i) => i !== rowIndex);
        onChange(fromRows(recalculateTimesteps(newRows)));
      }
    },
    [rowData, onChange, recalculateTimesteps],
  );

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
    },
    [rowData, onChange, recalculateTimesteps],
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
    },
    [rowData, onChange, recalculateTimesteps],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: handleDeleteRow,
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
    [translate, handleDeleteRow, handleInsertRowAbove, handleInsertRowBelow],
  );

  const columns = useMemo(
    (): Partial<Column>[] => [
      {
        ...keyColumn(
          "timestep",
          createTextReadonlyColumn({ className: "text-gray-500 bg-gray-50" }),
        ),
        title: translate("timestep"),
        minWidth: 50,
      },
      {
        ...keyColumn(
          "multiplier",
          createFloatColumn({ deleteValue: DEFAULT_MULTIPLIER }),
        ),
        title: translate("multiplier"),
        minWidth: 40,
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
        // Ensure we always have at least one row
        onChange([DEFAULT_MULTIPLIER]);
      } else {
        onChange(fromRows(recalculateTimesteps(newRows)));
      }
    },
    [onChange, recalculateTimesteps],
  );

  return (
    <div className="h-full">
      <SpreadsheetTable<PatternRow>
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
};
