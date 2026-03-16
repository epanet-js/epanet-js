import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { CurveGraph } from "./curve-graph";
import {
  CurvePoint,
  CurveType,
  stripTrailingEmptyPoints,
} from "src/hydraulic-model/curves";
import { type GridSelection } from "src/components/data-grid";
import { CurveTable, type CurveTableRef } from "./curve-table";
import { CurveErrorBanner } from "./curve-error-banner";
import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import clsx from "clsx";

interface CurveDetailProps {
  points: CurvePoint[];
  onChange: (points: CurvePoint[]) => void;
  readOnly?: boolean;
  curveType?: CurveType;
  units: UnitsSpec;
}

export function CurveDetail({
  points,
  onChange,
  readOnly = false,
  curveType,
  units,
}: CurveDetailProps) {
  const [selectedCells, setSelectedCells] = useState<GridSelection | null>(
    null,
  );
  const tableRef = useRef<CurveTableRef>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const meaningfulPoints = useMemo(
    () => stripTrailingEmptyPoints(points),
    [points],
  );

  const handleGraphClick = useCallback(
    (pointIndex: number | null) => {
      if (pointIndex === null) {
        setSelectedCells(null);
        return;
      }
      const rowIndex = pointIndex % meaningfulPoints.length;
      const newSelection = {
        min: { col: 0, row: rowIndex },
        max: { col: 1, row: rowIndex },
      };
      setSelectedCells(newSelection);
      tableRef.current?.selectCells({ rowIndex });
    },
    [meaningfulPoints.length],
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

  const graphSelectedIndex = useMemo(() => {
    if (!selectedCells) return null;
    const row = selectedCells.min.row;
    return row < meaningfulPoints.length ? row : null;
  }, [selectedCells, meaningfulPoints.length]);

  const handleTableSelectionChange = useCallback(
    (selection: GridSelection | null) => {
      setSelectedCells(selection);
    },
    [],
  );

  return (
    <div className={clsx("flex flex-col h-full", "py-3 pr-3")}>
      <div ref={tableContainerRef} className="h-[45%] min-h-0 overflow-hidden">
        <CurveTable
          ref={tableRef}
          points={points}
          onChange={onChange}
          onSelectionChange={handleTableSelectionChange}
          readOnly={readOnly}
          curveType={curveType}
          units={units}
        />
      </div>
      <CurveErrorBanner points={meaningfulPoints} curveType={curveType} />
      <div className="flex flex-col flex-1 min-h-0 mt-4">
        <CurveGraph
          ref={graphContainerRef}
          points={meaningfulPoints}
          curveType={curveType}
          units={units}
          selectedPointIndex={graphSelectedIndex}
          onPointClick={handleGraphClick}
        />
      </div>
    </div>
  );
}
