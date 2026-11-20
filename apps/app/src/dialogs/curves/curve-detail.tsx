import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { CurveGraph } from "./curve-graph";
import {
  CurvePoint,
  CurveType,
  stripTrailingEmptyPoints,
} from "@epanet-js/hydraulic-model";
import { type SelectedCells } from "src/components/data-grid";
import { CurveTable, type CurveTableRef } from "./curve-table";
import { CurveErrorBanner } from "./curve-error-banner";
import type { UnitsSpec } from "@epanet-js/project-settings";
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
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
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
        setSelectedRows([]);
        return;
      }
      const rowIndex = pointIndex % meaningfulPoints.length;
      setSelectedRows([rowIndex]);
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
        setSelectedRows([]);
        tableRef.current?.clearSelection();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const graphSelectedIndex = useMemo(() => {
    const row = selectedRows[0];
    return row !== undefined && row < meaningfulPoints.length ? row : null;
  }, [selectedRows, meaningfulPoints.length]);

  const handleTableSelectionChange = useCallback(
    (selection: SelectedCells | null) => {
      setSelectedRows(selection?.rowIndexes ?? []);
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
