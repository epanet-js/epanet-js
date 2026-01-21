import { useState, useRef, useCallback, useEffect } from "react";
import { PatternTable } from "./pattern-table";
import { PatternGraph } from "./pattern-graph";
import { DemandPattern } from "src/hydraulic-model/demands";
import { SpreadsheetSelection } from "src/components/spreadsheet-table";

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
  const [selectedCells, setSelectedCells] =
    useState<SpreadsheetSelection | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const handleGraphClick = useCallback(
    (barIndex: number | null) => {
      setSelectedCells((prev) => {
        const isSame = isSameSelection(prev, barIndex, pattern.length);
        if (isSame) return prev ? { ...prev } : prev;
        if (barIndex === null) return null;
        const rowIndex = barIndex % pattern.length;
        return {
          min: { col: 1, row: rowIndex },
          max: { col: 1, row: rowIndex },
        };
      });
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

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      <div
        ref={tableContainerRef}
        className="col-span-2 h-full overflow-hidden"
      >
        <PatternTable
          pattern={pattern}
          patternTimestepSeconds={patternTimestepSeconds}
          onChange={onChange}
          onSelectionChange={setSelectedCells}
          selection={selectedCells}
        />
      </div>
      <div className="col-span-3 h-full pt-4">
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

function isSameSelection(
  tableSelection: SpreadsheetSelection | null,
  graphSelection: number | null,
  dataLength: number,
): boolean {
  if (tableSelection === null || graphSelection === null) {
    return tableSelection === graphSelection;
  }

  const rowIndex = graphSelection % dataLength;
  return (
    tableSelection.min.row === rowIndex || tableSelection.max.row === rowIndex
  );
}
