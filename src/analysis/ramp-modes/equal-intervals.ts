import { roundToSignificantDigits } from "src/infra/rounding";

export const calculateEqualIntervalBreaks = (
  sortedData: number[],
  numBreaks: number,
) => {
  const minValue = sortedData[0];
  const maxValue = sortedData[sortedData.length - 1];
  if (minValue === maxValue) {
    return Array(numBreaks + 1).fill(roundToSignificantDigits(minValue));
  }

  const intervalSize = (maxValue - minValue) / numBreaks;
  const breaks = [roundToSignificantDigits(minValue)];

  for (let i = 1; i < numBreaks; i++) {
    const rawBreak = minValue + i * intervalSize;
    breaks.push(roundToSignificantDigits(rawBreak));
  }

  return breaks;
};
