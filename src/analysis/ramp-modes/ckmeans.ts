import { ckmeans } from "simple-statistics";

export const calculateCkmeansBreaks = (
  sortedData: number[],
  numBreaks: number,
): number[] => {
  const sortedClusters = ckmeans(sortedData, numBreaks + 1);
  return sortedClusters.slice(1).map((cluster) => cluster[0]);
};
