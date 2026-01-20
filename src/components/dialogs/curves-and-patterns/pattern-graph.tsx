import { useMemo } from "react";
import { BarGraph, type StyledBarValue } from "src/components/graphs/bar-graph";
import { DemandPattern } from "src/hydraulic-model/demands";
import { colors } from "src/lib/constants";

type BarCategory =
  | "original-in-duration"
  | "original-out-of-duration"
  | "cycled";

interface PatternGraphProps {
  pattern: DemandPattern;
  intervalSeconds: number;
  totalDurationSeconds: number;
}

export function PatternGraph({
  pattern,
  intervalSeconds,
  totalDurationSeconds,
}: PatternGraphProps) {
  const { values, labels } = useMemo(() => {
    return buildPatternData(pattern, intervalSeconds, totalDurationSeconds);
  }, [pattern, intervalSeconds, totalDurationSeconds]);

  return <BarGraph values={values} labels={labels} />;
}

function getColorForCategory(category: BarCategory): string {
  switch (category) {
    case "original-in-duration":
      return colors.purple500;
    case "original-out-of-duration":
      return colors.gray300;
    case "cycled":
      return colors.purple300;
  }
}

export function buildPatternData(
  pattern: DemandPattern,
  intervalSeconds: number,
  totalDurationSeconds: number,
): { values: StyledBarValue[]; labels: string[] } {
  if (pattern.length === 0) {
    return { values: [], labels: [] };
  }

  const totalSimulationIntervals =
    totalDurationSeconds === 0
      ? 1
      : Math.ceil(totalDurationSeconds / intervalSeconds);

  const totalBars = Math.max(pattern.length, totalSimulationIntervals);

  const values: StyledBarValue[] = [];
  const labels: string[] = [];

  for (let i = 0; i < totalBars; i++) {
    const patternIndex = i % pattern.length;
    const value = pattern[patternIndex];
    const isCycled = i >= pattern.length;
    const isWithinDuration = i < totalSimulationIntervals;

    let category: BarCategory;
    if (isCycled) {
      category = "cycled";
    } else if (isWithinDuration) {
      category = "original-in-duration";
    } else {
      category = "original-out-of-duration";
    }

    values.push({
      value,
      itemStyle: { color: getColorForCategory(category) },
    });

    if (isWithinDuration) {
      const totalSeconds = i * intervalSeconds;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      labels.push(`${hours}:${minutes.toString().padStart(2, "0")}`);
    } else {
      labels.push("");
    }
  }

  return { values, labels };
}
