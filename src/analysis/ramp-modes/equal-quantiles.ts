import { roundToSignificantDigits } from "src/infra/rounding";

export const calculateEqualQuantileBreaks = (
  sortedData: number[],
  numBreaks: number,
): number[] => {
  const n = sortedData.length;
  const breaks = [];

  for (let i = 1; i <= numBreaks; i++) {
    const quantile = i / (numBreaks + 1);
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
