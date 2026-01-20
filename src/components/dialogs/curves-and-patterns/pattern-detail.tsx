import { useState, useRef, useCallback } from "react";
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
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const tableGridRef = useRef<DataSheetGridRef>(null);

  const handleTableRowChange = useCallback((rowIndex: number | null) => {
    if (rowIndex === null) {
      return;
    }

    setHighlightedIndex((prev) => (prev === rowIndex ? prev : rowIndex));
  }, []);

  const handleBarClick = useCallback((barIndex: number) => {
    setHighlightedIndex((prev) => (prev === barIndex ? prev : barIndex));
    tableGridRef.current?.setActiveCell({ col: 1, row: barIndex });
  }, []);

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      <div className="col-span-2 h-full overflow-hidden">
        <PatternTable
          ref={tableGridRef}
          pattern={pattern}
          patternTimestepSeconds={patternTimestepSeconds}
          onChange={onChange}
          onActiveRowChange={handleTableRowChange}
        />
      </div>
      <div className="col-span-3 h-full pt-4">
        <PatternGraph
          pattern={pattern}
          intervalSeconds={patternTimestepSeconds}
          totalDurationSeconds={totalDurationSeconds}
          highlightedBarIndex={highlightedIndex}
          onBarClick={handleBarClick}
        />
      </div>
    </div>
  );
}
