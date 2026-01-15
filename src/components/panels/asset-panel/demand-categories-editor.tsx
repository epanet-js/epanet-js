import { useMemo, useCallback } from "react";
import { keyColumn, Column } from "react-datasheet-grid";
import {
  SpreadsheetTable,
  createFloatColumn,
} from "src/components/spreadsheet-table";
import { createFilterableSelectColumn } from "src/components/spreadsheet-table/filterable-select-column";
import { JunctionDemand, PatternId } from "src/hydraulic-model/demands";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";

type DemandCategoryRow = {
  baseDemand: number | null;
  patternId: string;
};

type Props = {
  demands: JunctionDemand[];
  patterns: Map<PatternId, number[]>;
  onDemandsChange: (newDemands: JunctionDemand[]) => void;
};

const CONSTANT_PATTERN_SENTINEL = ";CONSTANT";

const toRow = (demand: JunctionDemand): DemandCategoryRow => ({
  baseDemand: demand.baseDemand,
  patternId: demand.patternId ?? CONSTANT_PATTERN_SENTINEL,
});

const fromRow = (row: DemandCategoryRow): JunctionDemand => ({
  baseDemand: row.baseDemand ?? 0,
  patternId:
    row.patternId === CONSTANT_PATTERN_SENTINEL ? undefined : row.patternId,
});

const createDefaultRow = (): DemandCategoryRow => ({
  baseDemand: 0,
  patternId: CONSTANT_PATTERN_SENTINEL,
});

export const DemandCategoriesEditor = ({
  demands,
  patterns,
  onDemandsChange,
}: Props) => {
  const translate = useTranslate();

  const rowData = useMemo(
    () => (demands.length === 0 ? [createDefaultRow()] : demands.map(toRow)),
    [demands],
  );

  const patternOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      {
        value: CONSTANT_PATTERN_SENTINEL,
        label: translate("constant").toUpperCase(),
      },
    ];
    for (const patternId of patterns.keys()) {
      options.push({ value: patternId, label: patternId });
    }
    return options;
  }, [patterns, translate]);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      const newRows = rowData.filter((_, i) => i !== rowIndex);
      const newDemands = newRows.map(fromRow);
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
      const newDemands = newRows.map(fromRow);
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
      const newDemands = newRows.map(fromRow);
      onDemandsChange(newDemands);
    },
    [rowData, onDemandsChange],
  );

  const isDeleteDisabled = useCallback(
    (rowIndex: number) => {
      if (rowData.length > 1) return false;
      const row = rowData[rowIndex];
      return (
        row?.baseDemand === 0 && row?.patternId === CONSTANT_PATTERN_SENTINEL
      );
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

  const columns = useMemo(
    (): Partial<Column>[] => [
      {
        ...keyColumn("baseDemand", createFloatColumn({ deleteValue: 0 })),
        title: translate("baseDemand"),
        grow: 6,
      },
      {
        ...keyColumn(
          "patternId",
          createFilterableSelectColumn({
            options: patternOptions,
            deleteValue: CONSTANT_PATTERN_SENTINEL,
          }),
        ),
        title: translate("timePattern"),
        grow: 7,
      },
    ],
    [patternOptions, translate],
  );

  const createRow = createDefaultRow;

  const handleChange = useCallback(
    (newRows: DemandCategoryRow[]) => {
      // eslint-disable-next-line no-console
      console.log("DemandCategoriesEditor onChange:", newRows);
      const nonZeroRows = newRows.filter((row) => row.baseDemand !== 0);
      const newDemands =
        newRows.length === 1 ? nonZeroRows.map(fromRow) : newRows.map(fromRow);
      onDemandsChange(newDemands);
    },
    [onDemandsChange],
  );

  return (
    <SpreadsheetTable<DemandCategoryRow>
      data={rowData}
      columns={columns}
      onChange={handleChange}
      createRow={createRow}
      rowActions={rowActions}
      height={150}
      addRowLabel={translate("addDemandCategory")}
    />
  );
};
