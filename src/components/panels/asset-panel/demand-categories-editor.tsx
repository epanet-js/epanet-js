import { useMemo, useCallback } from "react";
import { keyColumn, floatColumn, Column } from "react-datasheet-grid";
import {
  SpreadsheetTable,
  createSelectColumn,
} from "src/components/spreadsheet-table";
import { JunctionDemand, PatternId } from "src/hydraulic-model/demands";
import { Unit } from "src/quantity";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";

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

  const columns: Column<DemandCategoryRow>[] = useMemo(
    () => [
      {
        ...keyColumn("baseDemand", floatColumn),
        title: `${translate("baseDemand")} (${translateUnit(unit)})`,
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
    />
  );
};
