import { useMemo } from "react";
import {
  DiscreteSeriesGraph,
  type DiscreteSeriesGraphVariant,
  type StyledBarValue,
} from "src/components/graphs/discrete-series-graph";
import { PatternMultipliers, PatternType } from "src/hydraulic-model";
import { colors } from "src/lib/constants";

const VALUE_COLOR = colors.purple500;
const FILLED_VALUE_COLOR = colors.purple300;
const IGNORED_VALUE_COLOR = colors.gray300;
const SELECTED_VALUE_COLOR = colors.fuchsia500;

interface PatternGraphProps {
  pattern: PatternMultipliers;
  patternType?: PatternType;
  intervalSeconds: number;
  totalDurationSeconds: number;
  highlightedBarIndices?: number[];
  onBarClick?: (index: number | null) => void;
  variant?: DiscreteSeriesGraphVariant;
}

export function PatternGraph({
  pattern,
  patternType,
  intervalSeconds,
  totalDurationSeconds,
  highlightedBarIndices,
  onBarClick,
  variant,
}: PatternGraphProps) {
  const { values, labels } = useMemo(() => {
    return buildPatternData(
      pattern,
      intervalSeconds,
      totalDurationSeconds,
      highlightedBarIndices,
    );
  }, [pattern, intervalSeconds, totalDurationSeconds, highlightedBarIndices]);

  const startYAxisAtZero = patternType !== "reservoirHead";

  return (
    <DiscreteSeriesGraph
      values={values}
      labels={labels}
      startYAxisAtZero={startYAxisAtZero}
      onBarClick={onBarClick}
      variant={variant}
    />
  );
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
    const baseColor = getBaseColor(i, pattern.length, totalSimulationIntervals);
    const isHighlighted = highlightedSet.has(i);
    const isSegmentHighlighted = isHighlighted && highlightedSet.has(i + 1);

    values.push({
      value,
      itemStyle: { color: isHighlighted ? SELECTED_VALUE_COLOR : baseColor },
      lineStyle: {
        color: isSegmentHighlighted ? SELECTED_VALUE_COLOR : baseColor,
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

function getBaseColor(
  index: number,
  patternLength: number,
  intervalsCount: number,
) {
  if (index >= patternLength) return FILLED_VALUE_COLOR;
  if (index >= intervalsCount) return IGNORED_VALUE_COLOR;
  return VALUE_COLOR;
}
