import { ckmeans } from "simple-statistics";

export const calculateCkmeansRange = (
  sortedData: number[],
  numIntervals: number,
): number[] => {
  const sortedClusters = ckmeans(sortedData, numIntervals + 1);
  return sortedClusters.map((cluster) => cluster[0]);
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
