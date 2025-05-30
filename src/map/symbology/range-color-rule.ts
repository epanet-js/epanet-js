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

export type RangeColorRule = {
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

export const initializeColorRule = ({
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
}): RangeColorRule => {
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

export const prependBreak = (colorRule: RangeColorRule): RangeColorRule => {
  const { breaks, colors } = colorRule;

  const newValue = breaks[0] > 0 ? 0 : Math.floor(breaks[0] - 1);

  const newBreaks = [newValue, ...breaks];
  const newColors = [defaultNewColor, ...colors];

  return {
    ...colorRule,
    mode: "manual",
    breaks: newBreaks,
    colors: newColors,
  };
};

export const appendBreak = (colorRule: RangeColorRule): RangeColorRule => {
  const { breaks, colors } = colorRule;

  const lastBreak = breaks[breaks.length - 1];
  const newBreaks = [...breaks, Math.floor(lastBreak + 1)];
  const newColors = [...colors, defaultNewColor];

  return {
    ...colorRule,
    mode: "manual",
    breaks: newBreaks,
    colors: newColors,
  };
};

export const reverseColors = (colorRule: RangeColorRule) => {
  const newColors = [...colorRule.colors].reverse();

  return {
    ...colorRule,
    reversedRamp: !colorRule.reversedRamp,
    colors: newColors,
  };
};

export const changeIntervalColor = (
  colorRule: RangeColorRule,
  index: number,
  color: string,
) => {
  const newColors = colorRule.colors.map((oldColor, i) =>
    i === index ? color : oldColor,
  );

  return {
    ...colorRule,
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
  colorRule: RangeColorRule,
  index: number,
  value: number,
): RangeColorRule => {
  const newBreaks = colorRule.breaks.map((oldValue, i) => {
    if (i !== index) return oldValue;

    return value;
  });

  return {
    ...colorRule,
    mode: "manual",
    breaks: newBreaks,
  };
};

export const deleteBreak = (
  colorRule: RangeColorRule,
  index: number,
): RangeColorRule => {
  const { breaks, colors } = colorRule;
  const newBreaks = breaks.filter((_, i) => i !== index);
  const newColors =
    index === 0 ? colors.slice(1) : colors.filter((c, i) => i - 1 !== index);

  return {
    ...colorRule,
    breaks: newBreaks,
    colors: newColors,
    mode: "manual",
  };
};

export const changeRampName = (
  colorRule: RangeColorRule,
  newRampName: string,
  isReversed: boolean,
) => {
  const newColors = getColors(newRampName, colorRule.colors.length, isReversed);

  return {
    ...colorRule,
    rampName: newRampName,
    reversedRamp: isReversed,
    colors: newColors,
  };
};

export const changeRangeSize = (
  colorRule: RangeColorRule,
  sortedValues: number[],
  numIntervals: number,
): { colorRule: RangeColorRule; error?: boolean } => {
  const { mode, fallbackEndpoints, rampName } = colorRule;
  const valid = checkValidData(mode, sortedValues, numIntervals);

  const newColors = getColors(
    rampName,
    numIntervals,
    Boolean(colorRule.reversedRamp),
  );

  const newBreaks = valid
    ? generateBreaks(mode, sortedValues, numIntervals, fallbackEndpoints)
    : Array(numIntervals - 1).fill(1);

  return {
    colorRule: {
      ...colorRule,
      breaks: newBreaks,
      colors: newColors,
    },
    error: !valid,
  };
};

export const applyMode = (
  colorRule: RangeColorRule,
  mode: RangeMode,
  sortedValues: number[],
): { colorRule: RangeColorRule; error?: boolean } => {
  const numIntervals = colorRule.colors.length as RampSize;
  const valid = checkValidData(mode, sortedValues, numIntervals);
  const newBreaks = valid
    ? generateBreaks(
        mode,
        sortedValues,
        numIntervals,
        colorRule.fallbackEndpoints,
      )
    : colorRule.breaks;

  return {
    colorRule: {
      ...colorRule,
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

export const nullRangeColorRule: RangeColorRule = {
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

export const colorFor = (colorRule: RangeColorRule, value: number) => {
  const { absValues, colors, breaks } = colorRule;
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
