import { ckmeans } from "simple-statistics";
import { roundToSignificantDigits } from "src/infra/rounding";

export const calculateCkmeansRange = (
  sortedData: number[],
  numIntervals: number,
): number[] => {
  const sortedClusters = ckmeans(sortedData, numIntervals + 1);
  return sortedClusters.map((cluster) => roundToSignificantDigits(cluster[0]));
};

export const checkCkmeansData = (
  sortedData: number[],
  numIntervals: number,
): boolean => {
  const distinctSet = new Set<number>();
  let i = 0;
  while (i < sortedData.length) {
    if (distinctSet.size > numIntervals) break;
    const value = sortedData[i];
    if (!distinctSet.has(value)) {
      distinctSet.add(value);
    }
    i++;
  }

  return distinctSet.size > numIntervals;
};
