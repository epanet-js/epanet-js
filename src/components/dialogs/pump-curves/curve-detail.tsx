import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { CurveGraph } from "./curve-graph";
import { CurvePoint, getPumpCurveType } from "src/hydraulic-model/curves";
import { type GridSelection } from "src/components/data-grid";
import { CurveTable, type CurveTableRef } from "./curve-table";
import { useTranslate } from "src/hooks/use-translate";
import { InlineField } from "src/components/form/fields";

interface CurveDetailProps {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  readOnly?: boolean;
}

export function CurveDetail({
  points,
  onChange,
  readOnly = false,
}: CurveDetailProps) {
  const [selectedCells, setSelectedCells] = useState<GridSelection | null>(
    null,
  );
  const tableRef = useRef<CurveTableRef>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const handleGraphClick = useCallback(
    (pointIndex: number | null) => {
      if (pointIndex === null) {
        setSelectedCells(null);
        return;
      }
      const rowIndex = pointIndex % points.length;
      const newSelection = {
        min: { col: 0, row: rowIndex },
        max: { col: 1, row: rowIndex },
      };
      setSelectedCells(newSelection);
      tableRef.current?.selectCells({ rowIndex });
    },
    [points.length],
  );

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInsideTable = tableContainerRef.current?.contains(target);
      const isInsideGraph = graphContainerRef.current?.contains(target);
      if (!isInsideTable && !isInsideGraph) {
        setSelectedCells(null);
        tableRef.current?.clearSelection();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const translate = useTranslate();
  const graphSelectedIndex = selectedCells ? selectedCells.min.row : null;

  const curveTypeLabel = useMemo(() => {
    const type = getPumpCurveType(points);
    switch (type) {
      case "design-point":
        return translate("designPointCurve");
      case "standard":
        return translate("standardCurve");
      case "multi-point":
        return translate("multiPointCurve");
    }
  }, [points, translate]);

  const handleTableSelectionChange = useCallback(
    (selection: GridSelection | null) => {
      setSelectedCells(selection);
    },
    [],
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div ref={tableContainerRef} className="flex-1 min-h-0 overflow-hidden">
        <CurveTable
          ref={tableRef}
          points={points}
          onChange={onChange}
          onSelectionChange={handleTableSelectionChange}
          readOnly={readOnly}
        />
      </div>
      <InlineField name={translate("pumpType")} layout="label-flex-none">
        <span className="text-sm">{curveTypeLabel}</span>
      </InlineField>
      <div className="flex-1 min-h-0 p-2 pt-4 border border-gray-200 dark:border-gray-700">
        <div ref={graphContainerRef} className="h-full">
          <CurveGraph
            points={points}
            selectedPointIndex={graphSelectedIndex}
            onPointClick={handleGraphClick}
          />
        </div>
      </div>
    </div>
  );
}
