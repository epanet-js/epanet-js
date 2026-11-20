import { useState, useRef, useCallback, useEffect } from "react";
import { PatternGraph } from "./pattern-graph";
import { PatternMultipliers, PatternType } from "src/hydraulic-model";
import { type SelectedCells } from "src/components/data-grid";
import { PatternTable, type PatternTableRef } from "./pattern-table";

interface PatternDetailProps {
  pattern: PatternMultipliers;
  patternType?: PatternType;
  patternTimestepSeconds: number;
  totalDurationSeconds: number;
  onChange: (pattern: PatternMultipliers) => void;
  readOnly?: boolean;
}

export function PatternDetail({
  pattern,
  patternType,
  patternTimestepSeconds,
  totalDurationSeconds,
  onChange,
  readOnly = false,
}: PatternDetailProps) {
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const tableRef = useRef<PatternTableRef>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const handleGraphClick = useCallback(
    (barIndex: number | null) => {
      if (barIndex === null) {
        setSelectedRows([]);
        return;
      }
      const rowIndex = barIndex % pattern.length;
      setSelectedRows([rowIndex]);
      tableRef.current?.selectCells({ rowIndex });
    },
    [pattern.length],
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

  const handleTableSelectionChange = useCallback(
    (selection: SelectedCells | null) => {
      setSelectedRows(selection?.rowIndexes ?? []);
    },
    [],
  );

  return (
    <div className="grid grid-cols-5 h-full gap-4">
      <div
        ref={tableContainerRef}
        className="col-span-2 h-full overflow-hidden pt-4 pb-3"
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
      <div className="col-span-3 h-full p-2 pt-4">
        <div ref={graphContainerRef} className="h-full">
          <PatternGraph
            pattern={pattern}
            patternType={patternType}
            intervalSeconds={patternTimestepSeconds}
            totalDurationSeconds={totalDurationSeconds}
            highlightedBarIndices={selectedRows}
            onBarClick={handleGraphClick}
          />
        </div>
      </div>
    </div>
  );
}
