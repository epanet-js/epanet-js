import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { calculatePrettyBreaks, checkValidData } from "./range-modes";
import { Unit } from "src/quantity";
import { calculateEqualIntervalRange } from "./range-modes/equal-intervals";
import { calculateEqualQuantilesRange } from "./range-modes/equal-quantiles";
import { calculateCkmeansRange } from "./range-modes/ckmeans";
import { calculateManualBreaks } from "./range-modes/manual";

export const rangeModes = [
  "equalIntervals",
  "equalQuantiles",
  "prettyBreaks",
  "ckmeans",
  "manual",
] as const;
export type RangeMode = (typeof rangeModes)[number];

export type SymbolizationRamp = {
  type: "ramp";
  simplestyle: boolean;
  defaultColor: string;
  defaultOpacity: number;
  interpolate: "step" | "linear";
  property: string;
  unit: Unit;
  reversedRamp?: boolean;
  absValues?: boolean;
  fallbackEndpoints: [number, number];
  mode: RangeMode;
  rampName: string;
  stops: { input: number; output: string }[];
  breaks: number[];
  colors: string[];
};

export type RangeEndpoints = [number, number];

export type RampSize = keyof CBColors["colors"];

export const defaultNewColor = "#0fffff";
export const maxIntervals = 7;
export const minIntervals = 3;

export const initializeSymbolization = ({
  mode,
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
  mode: RangeMode;
  sortedData: number[];
  property: string;
  unit: Unit;
  fallbackEndpoints?: RangeEndpoints;
  absValues?: boolean;
  reverseRamp?: boolean;
}): SymbolizationRamp => {
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
    type: "ramp",
    simplestyle: true,
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
    stops: stopsFrom(breaks, colors),
  };
};

export const prependBreak = (
  symbolization: SymbolizationRamp,
): SymbolizationRamp => {
  const { breaks, colors } = symbolization;

  const newValue = breaks[0] > 0 ? 0 : Math.floor(breaks[0] - 1);

  const newBreaks = [newValue, ...breaks];
  const newColors = [defaultNewColor, ...colors];

  return {
    ...symbolization,
    mode: "manual",
    breaks: newBreaks,
    colors: newColors,
    stops: stopsFrom(newBreaks, newColors),
  };
};

export const appendBreak = (
  symbolization: SymbolizationRamp,
): SymbolizationRamp => {
  const { breaks, colors } = symbolization;

  const lastBreak = breaks[breaks.length - 1];
  const newBreaks = [...breaks, Math.floor(lastBreak + 1)];
  const newColors = [...colors, defaultNewColor];

  return {
    ...symbolization,
    mode: "manual",
    breaks: newBreaks,
    colors: newColors,
    stops: stopsFrom(newBreaks, newColors),
  };
};

export const reverseColors = (symbolization: SymbolizationRamp) => {
  const newColors = [...symbolization.colors].reverse();

  return {
    ...symbolization,
    reversedRamp: !symbolization.reversedRamp,
    colors: newColors,
    stops: stopsFrom(symbolization.breaks, newColors),
  };
};

export const changeIntervalColor = (
  symbolization: SymbolizationRamp,
  index: number,
  color: string,
) => {
  const newColors = symbolization.colors.map((oldColor, i) =>
    i === index ? color : oldColor,
  );

  return {
    ...symbolization,
    colors: newColors,
    stops: stopsFrom(symbolization.breaks, newColors),
  };
};

export const validateAscindingBreaks = (candidates: number[]) => {
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i] < candidates[i - 1]) return false;
  }
  return true;
};

export const updateBreakValue = (
  symbolization: SymbolizationRamp,
  index: number,
  value: number,
): SymbolizationRamp => {
  const newBreaks = symbolization.breaks.map((oldValue, i) => {
    if (i !== index) return oldValue;

    return value;
  });

  return {
    ...symbolization,
    mode: "manual",
    breaks: newBreaks,
    stops: stopsFrom(newBreaks, symbolization.colors),
  };
};

export const deleteBreak = (
  symbolization: SymbolizationRamp,
  index: number,
): SymbolizationRamp => {
  const { breaks, colors } = symbolization;
  const newBreaks = breaks.filter((_, i) => i !== index);
  const newColors =
    index === 0 ? colors.slice(1) : colors.filter((c, i) => i - 1 !== index);

  return {
    ...symbolization,
    breaks: newBreaks,
    colors: newColors,
    stops: stopsFrom(newBreaks, newColors),
  };
};

export const changeRampName = (
  symbolization: SymbolizationRamp,
  newRampName: string,
  isReversed: boolean,
) => {
  const newColors = getColors(
    newRampName,
    symbolization.colors.length,
    isReversed,
  );

  return {
    ...symbolization,
    rampName: newRampName,
    reversedRamp: isReversed,
    colors: newColors,
    stops: stopsFrom(symbolization.breaks, newColors),
  };
};

export const changeRangeSize = (
  symbolization: SymbolizationRamp,
  sortedValues: number[],
  numIntervals: number,
): { symbolization: SymbolizationRamp; error?: boolean } => {
  const { mode, fallbackEndpoints, rampName } = symbolization;
  const valid = checkValidData(mode, sortedValues, numIntervals);

  const newColors = getColors(
    rampName,
    numIntervals,
    Boolean(symbolization.reversedRamp),
  );

  const newBreaks = valid
    ? generateBreaks(mode, sortedValues, numIntervals, fallbackEndpoints)
    : Array(numIntervals - 1).fill(1);

  return {
    symbolization: {
      ...symbolization,
      breaks: newBreaks,
      colors: newColors,
      stops: stopsFrom(newBreaks, newColors),
    },
    error: !valid,
  };
};

export const applyMode = (
  symbolization: SymbolizationRamp,
  mode: RangeMode,
  sortedValues: number[],
): { symbolization: SymbolizationRamp; error?: boolean } => {
  const numIntervals = symbolization.colors.length as RampSize;
  const valid = checkValidData(mode, sortedValues, numIntervals);
  const newBreaks = valid
    ? generateBreaks(
        mode,
        sortedValues,
        numIntervals,
        symbolization.fallbackEndpoints,
      )
    : symbolization.breaks;

  return {
    symbolization: {
      ...symbolization,
      mode,
      breaks: newBreaks,
      stops: stopsFrom(newBreaks, symbolization.colors),
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

  return breaks.map((value) => Number(value.toFixed(2)));
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

export const nullRampSymbolization: SymbolizationRamp = {
  type: "ramp",
  simplestyle: true,
  property: "",
  unit: null,
  defaultColor: "",
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName: "Temps",
  mode: "equalIntervals",
  stops: [],
  fallbackEndpoints: [0, 100],
  breaks: [],
  colors: [],
};

export const stopsFrom = (
  breaks: number[],
  colors: string[],
): SymbolizationRamp["stops"] => {
  const stopValues = [-Infinity, ...breaks];
  return stopValues.map((v, i) => ({
    input: v,
    output: colors[i],
  }));
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

export const colorFor = (symbolization: SymbolizationRamp, value: number) => {
  const { absValues, colors, breaks } = symbolization;
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
