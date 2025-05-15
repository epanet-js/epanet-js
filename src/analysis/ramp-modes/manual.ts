import { calculatePrettyBreaks } from "./pretty-breaks";

export const calculateManualBreaks = (
  sortedData: number[],
  numIntervals: number,
  fallbackEndpoints: number[],
) => {
  if (shouldUseFallback(sortedData)) {
    return calculatePrettyBreaks(fallbackEndpoints, numIntervals);
  }

  return calculatePrettyBreaks(sortedData, numIntervals);
};

const epsilon = 1e-9;

const shouldUseFallback = (sortedData: number[]) =>
  sortedData.length < 2 ||
  Math.abs(sortedData[0] - sortedData[sortedData.length - 1]) < epsilon;
