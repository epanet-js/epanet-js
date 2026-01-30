import { useState, useRef, useCallback, useEffect } from "react";
import { PatternGraph } from "./pattern-graph";
import { PatternMultipliers } from "src/hydraulic-model/demands";
import { type GridSelection } from "src/components/data-grid";
import { PatternTable, type PatternTableRef } from "./pattern-table";

interface PatternDetailProps {
  pattern: PatternMultipliers;
  patternTimestepSeconds: number;
  totalDurationSeconds: number;
  onChange: (pattern: PatternMultipliers) => void;
  readOnly?: boolean;
}

export function PatternDetail({
  pattern,
  patternTimestepSeconds,
  totalDurationSeconds,
  onChange,
  readOnly = false,
}: PatternDetailProps) {
  const [selectedCells, setSelectedCells] = useState<GridSelection | null>(
    null,
  );
  const tableRef = useRef<PatternTableRef>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const handleGraphClick = useCallback(
    (barIndex: number | null) => {
      if (barIndex === null) {
        setSelectedCells(null);
        return;
      }
      const rowIndex = barIndex % pattern.length;
      const newSelection = {
        min: { col: 0, row: rowIndex },
        max: { col: 1, row: rowIndex },
      };
      setSelectedCells(newSelection);
      tableRef.current?.setSelection(newSelection);
    },
    [pattern.length],
  );

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInsideTable = tableContainerRef.current?.contains(target);
      const isInsideGraph = graphContainerRef.current?.contains(target);
      if (!isInsideTable && !isInsideGraph) {
        setSelectedCells(null);
        tableRef.current?.setSelection(null);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const graphSelectedIndexes = selectedCells
    ? Array.from(
        { length: selectedCells.max.row - selectedCells.min.row + 1 },
        (_, i) => selectedCells.min.row + i,
      )
    : [];

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
        <PatternTable
          ref={tableRef}
          pattern={pattern}
          patternTimestepSeconds={patternTimestepSeconds}
          onChange={onChange}
          onSelectionChange={handleTableSelectionChange}
          readOnly={readOnly}
        />
      </div>
      <div className="col-span-3 h-full p-2 pt-4 border border-gray-200 dark:border-gray-700">
        <div ref={graphContainerRef} className="h-full">
          <PatternGraph
            pattern={pattern}
            intervalSeconds={patternTimestepSeconds}
            totalDurationSeconds={totalDurationSeconds}
            highlightedBarIndices={graphSelectedIndexes}
            onBarClick={handleGraphClick}
          />
        </div>
      </div>
    </div>
  );
}
