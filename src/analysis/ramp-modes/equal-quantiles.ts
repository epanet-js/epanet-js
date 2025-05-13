import { roundToSignificantDigits } from "src/infra/rounding";

export const calculateEqualQuantilesRange = (
  sortedData: number[],
  numIntervals: number,
): number[] => {
  const n = sortedData.length;
  const breaks = [];

  for (let i = 0; i < numIntervals + 1; i++) {
    const quantile = i / numIntervals;
    const index = quantile * (n - 1);

    if (Number.isInteger(index)) {
      breaks.push(sortedData[index]);
    } else {
      const lowerIndex = Math.floor(index);
      const upperIndex = Math.ceil(index);
      const fractionalPart = index - lowerIndex;
      const interpolatedValue =
        sortedData[lowerIndex] +
        (sortedData[upperIndex] - sortedData[lowerIndex]) * fractionalPart;
      breaks.push(roundToSignificantDigits(interpolatedValue));
    }
  }

  return breaks;
};
