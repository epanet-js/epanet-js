import { useMemo } from "react";
import { BarGraph } from "src/components/graphs/bar-graph";
import { DemandPattern } from "src/hydraulic-model/demands";

interface PatternGraphProps {
  pattern: DemandPattern;
  intervalSeconds: number;
  totalDurationSeconds?: number;
}

export function PatternGraph({
  pattern,
  intervalSeconds,
  totalDurationSeconds,
}: PatternGraphProps) {
  const { values, labels } = useMemo(() => {
    const cycledValues = cyclePattern(
      pattern,
      intervalSeconds,
      totalDurationSeconds,
    );
    const labels = buildTimeLabels(cycledValues.length, intervalSeconds);
    return { values: cycledValues, labels };
  }, [pattern, intervalSeconds, totalDurationSeconds]);

  return <BarGraph values={values} labels={labels} />;
}

function cyclePattern(
  pattern: DemandPattern,
  intervalSeconds: number,
  totalDurationSeconds?: number,
): number[] {
  if (!totalDurationSeconds || pattern.length === 0) return pattern;

  const totalIntervals = Math.ceil(totalDurationSeconds / intervalSeconds);
  if (totalIntervals <= pattern.length) {
    return pattern.slice(0, totalIntervals);
  }

  const result: number[] = [];
  for (let i = 0; i < totalIntervals; i++) {
    result.push(pattern[i % pattern.length]);
  }
  return result;
}

function buildTimeLabels(
  intervalsCount: number,
  intervalSeconds: number,
): string[] {
  const labels: string[] = [];
  for (let i = 0; i < intervalsCount; i++) {
    const totalSeconds = i * intervalSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    labels.push(`${hours}:${minutes.toString().padStart(2, "0")}`);
  }
  return labels;
}
