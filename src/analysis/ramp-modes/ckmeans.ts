import { ckmeans } from "simple-statistics";

export const calculateCkmeansRange = (
  sortedData: number[],
  numIntervals: number,
): number[] => {
  const sortedClusters = ckmeans(sortedData, numIntervals + 1);
  return sortedClusters.map((cluster) => cluster[0]);
};

export const calculateCkmeansBreaks = (
  sortedData: number[],
  numBreaks: number,
): number[] => {
  const sortedClusters = ckmeans(sortedData, numBreaks + 1);
  return sortedClusters.slice(1).map((cluster) => cluster[0]);
};
