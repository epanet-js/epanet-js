import { useMemo, useCallback } from "react";
import {
  DataGrid,
  floatColumn,
  filterableSelectColumn,
  GridColumn,
} from "src/components/data-grid";
import { JunctionDemand, DemandPatterns, PatternId } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";

type DemandCategoryRow = {
  baseDemand: number | null;
  patternId: PatternId;
};

type Props = {
  demands: JunctionDemand[];
  patterns: DemandPatterns;
  onDemandsChange: (newDemands: JunctionDemand[]) => void;
};

const CONSTANT_PATTERN_ID = 0;

const toRow = (
  demand: JunctionDemand,
  patterns: DemandPatterns,
): DemandCategoryRow => {
  if (demand.patternId) {
    const pattern = patterns.get(demand.patternId);
    if (pattern) {
      return {
        baseDemand: demand.baseDemand,
        patternId: demand.patternId,
      };
    }
  }
  return {
    baseDemand: demand.baseDemand,
    patternId: CONSTANT_PATTERN_ID,
  };
};

const fromRow = (row: DemandCategoryRow): JunctionDemand => {
  return {
    baseDemand: row.baseDemand ?? 0,
    patternId:
      row.patternId === CONSTANT_PATTERN_ID ? undefined : row.patternId,
  };
};

const createDefaultRow = (): DemandCategoryRow => ({
  baseDemand: 0,
  patternId: CONSTANT_PATTERN_ID,
});

export const DemandCategoriesEditor = ({
  demands,
  patterns,
  onDemandsChange,
}: Props) => {
  const translate = useTranslate();

  const rowData = useMemo(
    () =>
      demands.length === 0
        ? [createDefaultRow()]
        : demands.map((demand) => toRow(demand, patterns)),
    [demands, patterns],
  );

  const patternOptions = useMemo(() => {
    const options: { value: number; label: string }[] = [
      {
        value: CONSTANT_PATTERN_ID,
        label: translate("constant").toUpperCase(),
      },
    ];
    for (const [patternId, { label }] of patterns.entries()) {
      options.push({ value: patternId, label });
    }
    return options;
  }, [patterns, translate]);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      const newRows = rowData.filter((_, i) => i !== rowIndex);
      const newDemands = newRows.map((row) => fromRow(row));
      onDemandsChange(newDemands);
    },
    [rowData, onDemandsChange],
  );

  const handleInsertRowAbove = useCallback(
    (rowIndex: number) => {
      const newRow = createDefaultRow();
      const newRows = [
        ...rowData.slice(0, rowIndex),
        newRow,
        ...rowData.slice(rowIndex),
      ];
      const newDemands = newRows.map((row) => fromRow(row));
      onDemandsChange(newDemands);
    },
    [rowData, onDemandsChange],
  );

  const handleInsertRowBelow = useCallback(
    (rowIndex: number) => {
      const newRow = createDefaultRow();
      const newRows = [
        ...rowData.slice(0, rowIndex + 1),
        newRow,
        ...rowData.slice(rowIndex + 1),
      ];
      const newDemands = newRows.map((row) => fromRow(row));
      onDemandsChange(newDemands);
    },
    [rowData, onDemandsChange],
  );

  const isDeleteDisabled = useCallback(
    (rowIndex: number) => {
      if (rowData.length > 1) return false;
      const row = rowData[rowIndex];
      return row?.baseDemand === 0 && row?.patternId === CONSTANT_PATTERN_ID;
    },
    [rowData],
  );

  const rowActions = useMemo(
    () => [
      {
        label: translate("delete"),
        icon: <DeleteIcon size="sm" />,
        onSelect: handleDeleteRow,
        disabled: isDeleteDisabled,
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
      isDeleteDisabled,
    ],
  );

  const columns: GridColumn[] = useMemo(
    () => [
      floatColumn("baseDemand", {
        header: translate("demand"),
        size: 79,
        deleteValue: 0,
        nullValue: 0,
      }),
      filterableSelectColumn("patternId", {
        header: translate("timePattern"),
        size: 100,
        options: patternOptions,
        deleteValue: CONSTANT_PATTERN_ID,
      }),
    ],
    [translate, patternOptions],
  );

  const createRow = createDefaultRow;

  const handleChange = useCallback(
    (newRows: DemandCategoryRow[]) => {
      const nonZeroRows = newRows.filter((row) => row.baseDemand !== 0);
      const newDemands =
        newRows.length === 1
          ? nonZeroRows.map((row) => fromRow(row))
          : newRows.map((row) => fromRow(row));
      onDemandsChange(newDemands);
    },
    [onDemandsChange],
  );

  return (
    <div className="border-l-2 border-gray-400 bg-gray-50 pr-2">
      <DataGrid<DemandCategoryRow>
        variant="rows"
        maxHeight={150}
        data={rowData}
        columns={columns}
        onChange={handleChange}
        createRow={createRow}
        rowActions={rowActions}
        addRowLabel={translate("addDemandCategory")}
        gutterColumn
      />
    </div>
  );
};
