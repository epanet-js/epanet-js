import { roundToSignificantDigits } from "src/infra/rounding";

export const calculateEqualIntervalRange = (
  sortedData: number[],
  numIntervals: number,
) => {
  if (!checkEqualIntervalsData(sortedData))
    throw new Error("Invalid data for equal intervals");

  const minValue = sortedData[0];
  const maxValue = sortedData[sortedData.length - 1];
  const intervalSize = (maxValue - minValue) / numIntervals;
  const breaks = [];

  for (let i = 0; i <= numIntervals; i++) {
    const rawBreak = minValue + i * intervalSize;
    breaks.push(roundToSignificantDigits(rawBreak));
  }

  return breaks;
};

export const checkEqualIntervalsData = (sortedData: number[]): boolean => {
  if (!sortedData.length) return false;

  const minValue = sortedData[0];
  const maxValue = sortedData[sortedData.length - 1];
  if (minValue > maxValue || minValue === maxValue) return false;

  return true;
};
