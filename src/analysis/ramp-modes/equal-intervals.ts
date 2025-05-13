import { roundToSignificantDigits } from "src/infra/rounding";

export const calculateEqualIntervalRange = (
  sortedData: number[],
  numIntervals: number,
) => {
  const minValue = sortedData[0];
  const maxValue = sortedData[sortedData.length - 1];
  if (minValue === maxValue) {
    return Array(numIntervals + 1).fill(roundToSignificantDigits(minValue));
  }

  const intervalSize = (maxValue - minValue) / numIntervals;
  const breaks = [];

  for (let i = 0; i <= numIntervals; i++) {
    const rawBreak = minValue + i * intervalSize;
    breaks.push(roundToSignificantDigits(rawBreak));
  }

  return breaks;
};
