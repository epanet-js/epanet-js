import { PatternGraph } from "./pattern-graph";
import { PatternMultipliers } from "src/hydraulic-model/demands";
import { PatternTable } from "./pattern-table";

interface PatternDetailProps {
  pattern: PatternMultipliers;
  patternTimestepSeconds: number;
  totalDurationSeconds: number;
  onChange: (pattern: PatternMultipliers) => void;
}

export function PatternDetail({
  pattern,
  patternTimestepSeconds,
  totalDurationSeconds,
  onChange,
}: PatternDetailProps) {
  return (
    <div className="grid grid-cols-5 h-full">
      <div className="col-span-2 h-full overflow-hidden p-2 border-y border-r border-gray-200 dark:border-gray-700">
        <PatternTable
          pattern={pattern}
          patternTimestepSeconds={patternTimestepSeconds}
          onChange={onChange}
        />
      </div>
      <div className="col-span-3 h-full pt-4 p-2 border-y border-r border-gray-200 dark:border-gray-700">
        <div className="h-full">
          <PatternGraph
            pattern={pattern}
            intervalSeconds={patternTimestepSeconds}
            totalDurationSeconds={totalDurationSeconds}
          />
        </div>
      </div>
    </div>
  );
}
