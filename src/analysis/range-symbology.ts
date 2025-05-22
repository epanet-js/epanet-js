import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { calculatePrettyBreaks, checkValidData } from "./range-modes";
import { Unit } from "src/quantity";
import { calculateEqualIntervalRange } from "./range-modes/equal-intervals";
import { calculateEqualQuantilesRange } from "./range-modes/equal-quantiles";
import { calculateCkmeansRange } from "./range-modes/ckmeans";
import { calculateManualBreaks } from "./range-modes/manual";

export const rangeModesInOrder = [
  "prettyBreaks",
  "ckmeans",
  "equalQuantiles",
  "equalIntervals",
  "manual",
] as const;
export type RangeMode = (typeof rangeModesInOrder)[number];

export type RangeSymbology = {
  type: "range";
  defaultColor: string;
  defaultOpacity: number;
  interpolate: "step" | "linear";
  property: string;
  unit: Unit;
  fallbackEndpoints: [number, number];
  mode: RangeMode;
  rampName: string;
  breaks: number[];
  colors: string[];
  reversedRamp?: boolean;
  absValues?: boolean;
};

export type RangeEndpoints = [number, number];

export type RampSize = keyof CBColors["colors"];

export const defaultNewColor = "#0fffff";
export const maxIntervals = 7;
export const minIntervals = 3;

export const initializeSymbology = ({
  mode = "prettyBreaks",
  rampName,
  numIntervals = 5,
  sortedData,
  property,
  unit,
  fallbackEndpoints = [0, 100],
  absValues = false,
  reverseRamp = false,
}: {
  rampName: string;
  numIntervals?: number;
  mode?: RangeMode;
  sortedData: number[];
  property: string;
  unit: Unit;
  fallbackEndpoints?: RangeEndpoints;
  absValues?: boolean;
  reverseRamp?: boolean;
}): RangeSymbology => {
  const colors = getColors(rampName, numIntervals, reverseRamp);
  const isValid = checkValidData(mode, sortedData, numIntervals);

  let effectiveMode: RangeMode, breaks: number[];
  if (isValid) {
    effectiveMode = mode;
    breaks = generateBreaks(mode, sortedData, numIntervals, fallbackEndpoints);
  } else {
    effectiveMode = "manual";
    breaks = generateBreaks(
      "manual",
      sortedData,
      numIntervals,
      fallbackEndpoints,
    );
  }

  return {
    type: "range",
    property,
    unit,
    defaultColor: "",
    defaultOpacity: 0.3,
    interpolate: "step",
    rampName,
    mode: effectiveMode,
    fallbackEndpoints,
    absValues,
    reversedRamp: reverseRamp,
    breaks,
    colors,
  };
};

export const prependBreak = (symbology: RangeSymbology): RangeSymbology => {
  const { breaks, colors } = symbology;

  const newValue = breaks[0] > 0 ? 0 : Math.floor(breaks[0] - 1);

  const newBreaks = [newValue, ...breaks];
  const newColors = [defaultNewColor, ...colors];

  return {
    ...symbology,
    mode: "manual",
    breaks: newBreaks,
    colors: newColors,
  };
};

export const appendBreak = (symbology: RangeSymbology): RangeSymbology => {
  const { breaks, colors } = symbology;

  const lastBreak = breaks[breaks.length - 1];
  const newBreaks = [...breaks, Math.floor(lastBreak + 1)];
  const newColors = [...colors, defaultNewColor];

  return {
    ...symbology,
    mode: "manual",
    breaks: newBreaks,
    colors: newColors,
  };
};

export const reverseColors = (symbology: RangeSymbology) => {
  const newColors = [...symbology.colors].reverse();

  return {
    ...symbology,
    reversedRamp: !symbology.reversedRamp,
    colors: newColors,
  };
};

export const changeIntervalColor = (
  symbology: RangeSymbology,
  index: number,
  color: string,
) => {
  const newColors = symbology.colors.map((oldColor, i) =>
    i === index ? color : oldColor,
  );

  return {
    ...symbology,
    colors: newColors,
  };
};

export const validateAscindingBreaks = (candidates: number[]) => {
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i] < candidates[i - 1]) return false;
  }
  return true;
};

export const updateBreakValue = (
  symbology: RangeSymbology,
  index: number,
  value: number,
): RangeSymbology => {
  const newBreaks = symbology.breaks.map((oldValue, i) => {
    if (i !== index) return oldValue;

    return value;
  });

  return {
    ...symbology,
    mode: "manual",
    breaks: newBreaks,
  };
};

export const deleteBreak = (
  symbology: RangeSymbology,
  index: number,
): RangeSymbology => {
  const { breaks, colors } = symbology;
  const newBreaks = breaks.filter((_, i) => i !== index);
  const newColors =
    index === 0 ? colors.slice(1) : colors.filter((c, i) => i - 1 !== index);

  return {
    ...symbology,
    breaks: newBreaks,
    colors: newColors,
  };
};

export const changeRampName = (
  symbology: RangeSymbology,
  newRampName: string,
  isReversed: boolean,
) => {
  const newColors = getColors(newRampName, symbology.colors.length, isReversed);

  return {
    ...symbology,
    rampName: newRampName,
    reversedRamp: isReversed,
    colors: newColors,
  };
};

export const changeRangeSize = (
  symbology: RangeSymbology,
  sortedValues: number[],
  numIntervals: number,
): { symbology: RangeSymbology; error?: boolean } => {
  const { mode, fallbackEndpoints, rampName } = symbology;
  const valid = checkValidData(mode, sortedValues, numIntervals);

  const newColors = getColors(
    rampName,
    numIntervals,
    Boolean(symbology.reversedRamp),
  );

  const newBreaks = valid
    ? generateBreaks(mode, sortedValues, numIntervals, fallbackEndpoints)
    : Array(numIntervals - 1).fill(1);

  return {
    symbology: {
      ...symbology,
      breaks: newBreaks,
      colors: newColors,
    },
    error: !valid,
  };
};

export const applyMode = (
  symbology: RangeSymbology,
  mode: RangeMode,
  sortedValues: number[],
): { symbology: RangeSymbology; error?: boolean } => {
  const numIntervals = symbology.colors.length as RampSize;
  const valid = checkValidData(mode, sortedValues, numIntervals);
  const newBreaks = valid
    ? generateBreaks(
        mode,
        sortedValues,
        numIntervals,
        symbology.fallbackEndpoints,
      )
    : symbology.breaks;

  return {
    symbology: {
      ...symbology,
      mode,
      breaks: newBreaks,
    },
    error: !valid,
  };
};

const generateBreaks = (
  mode: RangeMode,
  sortedValues: number[],
  numIntervals: number,
  fallbackEndpoints: RangeEndpoints,
): number[] => {
  let breaks;
  if (mode === "prettyBreaks" || mode === "manual") {
    const totalBreaks = numIntervals - 1;
    breaks = calculateBreaks(
      mode,
      sortedValues,
      totalBreaks,
      fallbackEndpoints,
    );
  } else {
    const totalPoints = numIntervals;
    const points = calculateRange(mode, sortedValues, totalPoints);
    breaks = points.slice(1, -1);
  }

  if (breaks.length !== numIntervals - 1) {
    throw new Error("Invalid number of breaks!");
  }

  return breaks;
};

const calculateBreaks = (
  mode: RangeMode,
  sortedValues: number[],
  numIntervals: number,
  fallbackEndpoints: RangeEndpoints,
) => {
  switch (mode) {
    case "equalIntervals":
    case "equalQuantiles":
    case "ckmeans":
      throw new Error("Not implemented");
    case "manual":
      return calculateManualBreaks(
        sortedValues,
        numIntervals,
        fallbackEndpoints,
      );
    case "prettyBreaks":
      return calculatePrettyBreaks(sortedValues, numIntervals);
  }
};

const calculateRange = (
  mode: RangeMode,
  sortedValues: number[],
  numIntervals: number,
): number[] => {
  switch (mode) {
    case "equalIntervals":
      return calculateEqualIntervalRange(sortedValues, numIntervals);
    case "equalQuantiles":
      return calculateEqualQuantilesRange(sortedValues, numIntervals);
    case "ckmeans":
      return calculateCkmeansRange(sortedValues, numIntervals);
    case "prettyBreaks":
    case "manual":
      throw new Error("Not implemented");
  }
};

export const nullRangeSymbology: RangeSymbology = {
  type: "range",
  property: "",
  unit: null,
  defaultColor: "",
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName: "Temps",
  mode: "equalIntervals",
  fallbackEndpoints: [0, 100],
  breaks: [],
  colors: [],
};

export const getColors = (
  rampName: string,
  numIntervals: number,
  reverse = false,
): string[] => {
  const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === rampName)!;
  const colors = ramp.colors[numIntervals as RampSize] as string[];
  return reverse ? [...colors].reverse() : colors;
};

export const colorFor = (symbology: RangeSymbology, value: number) => {
  const { absValues, colors, breaks } = symbology;
  const effectiveValue = absValues ? Math.abs(value) : value;

  if (effectiveValue < breaks[0]) return colors[0];
  if (effectiveValue >= breaks[breaks.length - 1])
    return colors[colors.length - 1];

  for (let i = 0; i < breaks.length - 1; i++) {
    if (effectiveValue >= breaks[i] && effectiveValue < breaks[i + 1])
      return colors[i + 1];
  }

  throw new Error("Value without color");
};
