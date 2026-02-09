import { useState, useRef, useCallback, useEffect } from "react";
import { CurveGraph } from "./curve-graph";
import { CurvePoint } from "src/hydraulic-model/curves";
import { type GridSelection } from "src/components/data-grid";
import { CurveTable, type CurveTableRef } from "./curve-table";

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

  const graphSelectedIndex = selectedCells ? selectedCells.min.row : null;

  const handleTableSelectionChange = useCallback(
    (selection: GridSelection | null) => {
      setSelectedCells(selection);
    },
    [],
  );

  return (
    <div className="grid grid-cols-5 h-full gap-4">
      <div
        ref={tableContainerRef}
        className="col-span-2 h-full overflow-hidden"
      >
        <CurveTable
          ref={tableRef}
          points={points}
          onChange={onChange}
          onSelectionChange={handleTableSelectionChange}
          readOnly={readOnly}
        />
      </div>
      <div className="col-span-3 h-full p-2 pt-4 border border-gray-200 dark:border-gray-700">
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
