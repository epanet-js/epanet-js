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

function roundToSignificantDigits(num: number, digits = 3) {
  if (num === 0) {
    return 0;
  }
  const scale = Math.pow(
    10,
    digits - Math.floor(Math.log10(Math.abs(num))) - 1,
  );
  return Math.round(num * scale) / scale;
}
