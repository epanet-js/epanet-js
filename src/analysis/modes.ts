import {
  calculatePrettyBreaks as calculatePrettyBreaksImpl,
  PrettyBreaksResult,
} from "./pretty-breaks";

import { ckmeans, jenks } from "simple-statistics";

import { calculatePrettyBreaks as calculatePrettyBreaksAltImpl } from "./pretty-breaks-alt";

export const calculateEqualQuantileBreaks = (
  sortedData: number[],
  numBreaks: number
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
      breaks.push(interpolatedValue);
    }
  }

  return breaks;
};

export const calculateEqualIntervalBreaks = (
  sortedData: number[],
  numBreaks: number
) => {
  const minValue = sortedData[0];
  const maxValue = sortedData[sortedData.length - 1];
  if (minValue === maxValue) {
    return Array(numBreaks + 1).fill(roundToSignificantDigits(minValue, 3)); // Round single value
  }

  const intervalSize = (maxValue - minValue) / numBreaks;
  const breaks = [roundToSignificantDigits(minValue, 3)]; // Round the starting value

  for (let i = 1; i < numBreaks; i++) {
    const rawBreak = minValue + i * intervalSize;
    breaks.push(roundToSignificantDigits(rawBreak, 3)); // Round each break point
  }

  return breaks;
};

function roundToSignificantDigits(num: number, digits: number) {
  if (num === 0) {
    return 0;
  }
  const scale = Math.pow(
    10,
    digits - Math.floor(Math.log10(Math.abs(num))) - 1
  );
  return Math.round(num * scale) / scale;
}

export function calculatePrettyBreaks(
  sortedValues: number[],
  numBreaks: number
): PrettyBreaksResult {
  const result = calculatePrettyBreaksImpl(sortedValues, numBreaks);
  console.log("calculatePrettyBreaks result:", result);
  return result;
}

export function calculatePrettyBreaksAlt(
  sortedValues: number[],
  numBreaks: number
): number[] {
  console.log("calculatePrettyBreaksAlt sortedValues:", sortedValues);
  console.log("calculatePrettyBreaksAlt numBreaks:", numBreaks);
  const minValue = sortedValues[0];
  const maxValue = sortedValues[sortedValues.length - 1];
  const breaks = calculatePrettyBreaksAltImpl(minValue, maxValue, numBreaks);

  console.log("calculatePrettyBreaksAlt breaks:", breaks);
  return breaks;
}

export function calculateCkmeansBreaks(
  sortedValues: number[],
  numBreaks: number
): number[] {
  const sortedData = ckmeans(sortedValues, numBreaks);
  //const jenksData = jenks(sortedValues, numBreaks);
  //console.log("calculateCkmeansBreaks jenksData:", jenksData);
  console.log("calculateCkmeansBreaks sortedData:", sortedData);
  const breaks = sortedData.slice(1).map((cluster) => cluster[0]);
  console.log("calculateCkmeansBreaks breaks:", breaks);
  return breaks;
}

export function calculatePrettyBreaksAlt2(
  sortedData: number[],
  numBreaks: number
): number[] {
  const minVal = sortedData[0];
  const maxVal = sortedData[sortedData.length - 1];
  const range = maxVal - minVal;

  const roughStep = range / (numBreaks - 1);
  const niceSteps = [1, 2, 5, 10];
  let bestStep = range;
  let bestStepSize = 0;

  for (const nice of niceSteps) {
    const stepSize =
      nice * Math.pow(10, Math.floor(Math.log10(roughStep / nice)));
    if (Math.abs(stepSize - roughStep) < bestStep) {
      bestStep = Math.abs(stepSize - roughStep);
      bestStepSize = stepSize;
    }
  }

  let breaks = [minVal];
  let currentBreak = minVal;
  while (breaks.length < numBreaks - 1 && currentBreak < maxVal) {
    currentBreak += bestStepSize;
    breaks.push(currentBreak);
  }
  breaks.push(maxVal);

  breaks[breaks.length - 1] = maxVal;

  breaks = [...new Set(breaks)].sort((a, b) => a - b);

  while (breaks.length < numBreaks && breaks[breaks.length - 1] < maxVal) {
    breaks.push(breaks[breaks.length - 1] + bestStepSize);
  }
  if (breaks.length > numBreaks) {
    breaks = breaks.slice(0, numBreaks);
  }
  if (breaks[breaks.length - 1] < maxVal) {
    breaks[breaks.length - 1] = maxVal;
  }
  return breaks;
}
