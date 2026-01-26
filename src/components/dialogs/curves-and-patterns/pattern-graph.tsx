import { useMemo } from "react";
import { BarGraph, type StyledBarValue } from "src/components/graphs/bar-graph";
import { PatternMultipliers } from "src/hydraulic-model/demands";
import { colors } from "src/lib/constants";

const VALUE_COLOR = colors.purple500;
const FILLED_VALUE_COLOR = colors.purple300;
const IGNORED_VALUE_COLOR = colors.gray300;

interface PatternGraphProps {
  pattern: PatternMultipliers;
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

export function buildPatternData(
  pattern: PatternMultipliers,
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

  const patternValuesCount = Math.max(pattern.length, totalSimulationIntervals);

  const values: StyledBarValue[] = [];
  const labels: string[] = [];

  for (let i = 0; i < patternValuesCount; i++) {
    const patternIndex = i % pattern.length;
    const value = pattern[patternIndex];

    values.push({
      value,
      itemStyle: {
        color: getValueColor(i, pattern.length, totalSimulationIntervals),
      },
    });

    if (i < totalSimulationIntervals) {
      labels.push(buildTimeLabel(i, intervalSeconds));
    } else {
      labels.push("");
    }
  }

  return { values, labels };
}

function buildTimeLabel(i: number, intervalSeconds: number) {
  const totalSeconds = i * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function getValueColor(
  index: number,
  patternLength: number,
  intervalsCount: number,
) {
  if (index >= patternLength) return FILLED_VALUE_COLOR;
  if (index >= intervalsCount) return IGNORED_VALUE_COLOR;
  return VALUE_COLOR;
}
