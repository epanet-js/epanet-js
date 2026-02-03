import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  DataGrid,
  DataGridRef,
  floatColumn,
  filterableSelectColumn,
  GridColumn,
} from "src/components/data-grid";
import { Button } from "src/components/elements";
import { JunctionDemand, DemandPatterns, PatternId } from "src/hydraulic-model";
import { useTranslate } from "src/hooks/use-translate";
import { DeleteIcon, AddIcon } from "src/icons";
import { PropertyComparison } from "src/hooks/use-asset-comparison";
import { calculateAverageDemand } from "src/hydraulic-model/demands";
import { Quantities } from "src/model-metadata/quantities-spec";
import { QuantityRow } from "./ui-components";

type DemandCategoryRow = {
  baseDemand: number | null;
  patternId: PatternId;
};

type Props = {
  demands: JunctionDemand[];
  patterns: DemandPatterns;
  onDemandsChange: (newDemands: JunctionDemand[]) => void;
  comparison?: PropertyComparison;
  readOnly?: boolean;
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
  comparison,
  readOnly = false,
}: Props) => {
  const translate = useTranslate();
  const [showEmptyGrid, setShowEmptyGrid] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<DataGridRef>(null);

  useEffect(function clearSelectionOnClickOutside() {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;

      if (containerRef.current?.contains(target)) {
        return;
      }

      if (
        (target as Element).closest?.("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }

      gridRef.current?.setSelection(null);
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const rowData = useMemo(() => {
    if (demands.length === 0 && showEmptyGrid) {
      return [createDefaultRow()];
    }
    return demands.map((demand) => toRow(demand, patterns));
  }, [demands, patterns, showEmptyGrid]);

  const handleAddFirstDemand = useCallback(() => {
    setShowEmptyGrid(true);
  }, []);

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
        size: 60,
        deleteValue: 0,
        nullValue: 0,
      }),
      filterableSelectColumn("patternId", {
        header: translate("timePattern"),
        size: 80,
        options: patternOptions,
        deleteValue: CONSTANT_PATTERN_ID,
      }),
    ],
    [translate, patternOptions],
  );

  const createRow = createDefaultRow;

  const handleChange = useCallback(
    (newRows: DemandCategoryRow[]) => {
      const newDemands = newRows.map((row) => fromRow(row));

      const isSingleDefaultDemand =
        newDemands.length === 1 &&
        newDemands[0].baseDemand === 0 &&
        newDemands[0].patternId === undefined;

      if (isSingleDefaultDemand) {
        setShowEmptyGrid(true);
        if (demands.length !== 0) onDemandsChange([]);
        return;
      }

      setShowEmptyGrid(false);

      const areEqual =
        newDemands.length === demands.length &&
        newDemands.every(
          (d, i) =>
            d.baseDemand === demands[i].baseDemand &&
            d.patternId === demands[i].patternId,
        );

      if (areEqual) {
        return;
      }

      onDemandsChange(newDemands);
    },
    [onDemandsChange, demands],
  );

  if (demands.length === 0 && !showEmptyGrid) {
    if (readOnly) {
      return null;
    }

    return (
      <Button
        variant="default"
        size="sm"
        onClick={handleAddFirstDemand}
        className="w-full justify-center"
      >
        <AddIcon size="sm" />
        {translate("addDirectDemand")}
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      {comparison?.hasChanged && (
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
      )}
      <label
        className="text-sm text-gray-500 w-full flex-shrink-0"
        aria-label={`label: ${translate("demandCategories")}`}
      >
        {translate("demandCategories")}
      </label>
      <div className="border-l-2 border-gray-400 bg-gray-50 pr-2 pb-2">
        <DataGrid<DemandCategoryRow>
          ref={gridRef}
          data={rowData}
          columns={columns}
          onChange={handleChange}
          createRow={createRow}
          rowActions={rowActions}
          addRowLabel={translate("addDemandCategory")}
          variant="rows"
          gutterColumn
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};

export const DemandsEditor = ({
  demands,
  patterns,
  quantitiesMetadata,
  name,
  onChange,
  demandComparator,
  readOnly,
}: {
  demands: JunctionDemand[];
  patterns: DemandPatterns;
  quantitiesMetadata: Quantities;
  name: string;
  onChange: (demands: JunctionDemand[]) => void;
  demandComparator: (
    demands: number,
    patterns: DemandPatterns,
  ) => PropertyComparison;
  readOnly: boolean;
}) => {
  const averageDemand = useMemo(
    () => calculateAverageDemand(demands, patterns),
    [demands, patterns],
  );

  const demandComparison = demandComparator(averageDemand, patterns);

  return (
    <div className="relative flex flex-col gap-2">
      {demandComparison.hasChanged && (
        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-purple-500 rounded-full" />
      )}
      <DemandCategoriesEditor
        demands={demands}
        patterns={patterns}
        onDemandsChange={onChange}
        comparison={demandComparison}
        readOnly={readOnly}
      />
      <QuantityRow
        name={name}
        value={averageDemand}
        unit={quantitiesMetadata.getUnit("directDemand")}
        decimals={quantitiesMetadata.getDecimals("directDemand")}
        comparison={demandComparison}
        readOnly={true}
      />
    </div>
  );
};
