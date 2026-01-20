import { useState, useRef, useCallback, useEffect } from "react";
import { PatternTable } from "./pattern-table";
import { PatternGraph } from "./pattern-graph";
import { DemandPattern } from "src/hydraulic-model/demands";
import { type DataSheetGridRef } from "src/components/spreadsheet-table";

interface PatternDetailProps {
  pattern: DemandPattern;
  patternTimestepSeconds: number;
  totalDurationSeconds: number;
  onChange: (pattern: DemandPattern) => void;
}

export function PatternDetail({
  pattern,
  patternTimestepSeconds,
  totalDurationSeconds,
  onChange,
}: PatternDetailProps) {
  const [highlightedIndices, setHighlightedIndices] = useState<number[]>([]);
  const tableGridRef = useRef<DataSheetGridRef>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const handleSelectedRowsChange = useCallback(
    (range: { minRow: number; maxRow: number } | null) => {
      if (range === null) {
        return;
      }
      const indices: number[] = [];
      for (let i = range.minRow; i <= range.maxRow; i++) {
        indices.push(i);
      }
      setHighlightedIndices(indices);
    },
    [],
  );

  const handleBarClick = useCallback((barIndex: number | null) => {
    if (barIndex === null) {
      setHighlightedIndices([]);
      return;
    }
    setHighlightedIndices([barIndex]);
    tableGridRef.current?.setActiveCell({ col: 1, row: barIndex });
  }, []);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideTable = tableContainerRef.current?.contains(target);
      const isInsideGraph = graphContainerRef.current?.contains(target);
      if (!isInsideTable && !isInsideGraph) {
        setHighlightedIndices([]);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      <div
        ref={tableContainerRef}
        className="col-span-2 h-full overflow-hidden"
      >
        <PatternTable
          ref={tableGridRef}
          pattern={pattern}
          patternTimestepSeconds={patternTimestepSeconds}
          onChange={onChange}
          onSelectedRowsChange={handleSelectedRowsChange}
        />
      </div>
      <div className="col-span-3 h-full pt-4">
        <div ref={graphContainerRef} className="h-full">
          <PatternGraph
            pattern={pattern}
            intervalSeconds={patternTimestepSeconds}
            totalDurationSeconds={totalDurationSeconds}
            highlightedBarIndices={highlightedIndices}
            onBarClick={handleBarClick}
          />
        </div>
      </div>
    </div>
  );
}
