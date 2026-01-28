import { useMemo } from "react";
import { BarGraph, type StyledBarValue } from "src/components/graphs/bar-graph";
import { PatternMultipliers } from "src/hydraulic-model/demands";
import { colors } from "src/lib/constants";

const VALUE_COLOR = colors.purple500;
const FILLED_VALUE_COLOR = colors.purple300;
const IGNORED_VALUE_COLOR = colors.gray300;
const SELECTED_VALUE_COLOR = colors.fuchsia500;

interface PatternGraphProps {
  pattern: PatternMultipliers;
  intervalSeconds: number;
  totalDurationSeconds: number;
  highlightedBarIndices?: number[];
  onBarClick?: (index: number | null) => void;
}

export function PatternGraph({
  pattern,
  intervalSeconds,
  totalDurationSeconds,
  highlightedBarIndices,
  onBarClick,
}: PatternGraphProps) {
  const { values, labels } = useMemo(() => {
    return buildPatternData(
      pattern,
      intervalSeconds,
      totalDurationSeconds,
      highlightedBarIndices,
    );
  }, [pattern, intervalSeconds, totalDurationSeconds, highlightedBarIndices]);

  return <BarGraph values={values} labels={labels} onBarClick={onBarClick} />;
}

export function buildPatternData(
  pattern: PatternMultipliers,
  intervalSeconds: number,
  totalDurationSeconds: number,
  highlightedBarIndices?: number[],
): { values: StyledBarValue[]; labels: string[] } {
  if (pattern.length === 0) {
    return { values: [], labels: [] };
  }

  const totalSimulationIntervals =
    totalDurationSeconds === 0
      ? 1
      : Math.ceil(totalDurationSeconds / intervalSeconds);

  const patternValuesCount = Math.max(pattern.length, totalSimulationIntervals);
  const highlightedSet = expandSelectionWithFilledValues(
    highlightedBarIndices,
    pattern,
    patternValuesCount,
  );

  const values: StyledBarValue[] = [];
  const labels: string[] = [];

  for (let i = 0; i < patternValuesCount; i++) {
    const patternIndex = i % pattern.length;
    const value = pattern[patternIndex];

    values.push({
      value,
      itemStyle: {
        color: getValueColor(
          i,
          highlightedSet,
          pattern.length,
          totalSimulationIntervals,
        ),
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

function expandSelectionWithFilledValues(
  highlightedBarIndices: number[] | undefined,
  pattern: PatternMultipliers,
  totalBars: number,
) {
  const highlightedSet = new Set<number>();
  if (highlightedBarIndices && pattern.length > 0) {
    for (const patternIndex of highlightedBarIndices) {
      for (let i = patternIndex; i < totalBars; i += pattern.length) {
        highlightedSet.add(i);
      }
    }
  }
  return highlightedSet;
}

function buildTimeLabel(i: number, intervalSeconds: number) {
  const totalSeconds = i * intervalSeconds;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

function getValueColor(
  index: number,
  highlightedIndices: Set<number>,
  patternLength: number,
  intervalsCount: number,
) {
  if (highlightedIndices.has(index)) return SELECTED_VALUE_COLOR;
  if (index >= patternLength) return FILLED_VALUE_COLOR;
  if (index >= intervalsCount) return IGNORED_VALUE_COLOR;
  return VALUE_COLOR;
}
