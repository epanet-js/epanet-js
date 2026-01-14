import { useMemo, useCallback } from "react";
import { keyColumn, Column } from "react-datasheet-grid";
import {
  SpreadsheetTable,
  createSelectColumn,
  createFloatColumn,
} from "src/components/spreadsheet-table";
import { JunctionDemand, PatternId } from "src/hydraulic-model/demands";
import { Unit } from "src/quantity";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { DeleteIcon, AddIcon } from "src/icons";

type DemandCategoryRow = {
  baseDemand: number | null;
  patternId: string | null;
};

type Props = {
  demands: JunctionDemand[];
  patterns: Map<PatternId, number[]>;
  unit: Unit;
  onDemandsChange: (newDemands: JunctionDemand[]) => void;
};

const toRow = (demand: JunctionDemand): DemandCategoryRow => ({
  baseDemand: demand.baseDemand,
  patternId: demand.patternId ?? null,
});

const fromRow = (row: DemandCategoryRow): JunctionDemand => ({
  baseDemand: row.baseDemand ?? 0,
  patternId: row.patternId || undefined,
});

export const DemandCategoriesEditor = ({
  demands,
  patterns,
  unit,
  onDemandsChange,
}: Props) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();

  const rowData = useMemo(() => demands.map(toRow), [demands]);

  const patternOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (const patternId of patterns.keys()) {
      options.push({ value: patternId, label: patternId });
    }
    return options;
  }, [patterns]);

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
      const newRow: DemandCategoryRow = { baseDemand: 0, patternId: null };
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
      const newRow: DemandCategoryRow = { baseDemand: 0, patternId: null };
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
        ...keyColumn("baseDemand", createFloatColumn()),
        title: `${translate("baseDemand")} (${translateUnit(unit)})`,
        basis: 80,
        grow: 0,
        shrink: 0,
      },
      {
        ...keyColumn(
          "patternId",
          createSelectColumn({
            options: patternOptions,
            placeholder: translate("constant"),
          }),
        ),
        title: translate("timePattern"),
      },
    ],
    [patternOptions, unit, translate, translateUnit],
  );

  const createRow = useCallback(
    (): DemandCategoryRow => ({
      baseDemand: 0,
      patternId: null,
    }),
    [],
  );

  const handleChange = useCallback(
    (newRows: DemandCategoryRow[]) => {
      const newDemands = newRows.map(fromRow);
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
    />
  );
};
