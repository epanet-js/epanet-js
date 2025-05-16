import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { ISymbolizationRamp } from "src/types";
import { calculatePrettyBreaks, checkValidData } from "./ramp-modes";
import { Unit } from "src/quantity";
import { calculateEqualIntervalRange } from "./ramp-modes/equal-intervals";
import { calculateEqualQuantilesRange } from "./ramp-modes/equal-quantiles";
import { calculateCkmeansRange } from "./ramp-modes/ckmeans";
import { calculateManualBreaks } from "./ramp-modes/manual";

type SymbolizationRamp = ISymbolizationRamp;
export type RampEndpoints = [number, number];

export const rangeModes = [
  "equalIntervals",
  "equalQuantiles",
  "prettyBreaks",
  "ckmeans",
  "manual",
] as const;
export type RangeMode = (typeof rangeModes)[number];

export type RampSize = keyof CBColors["colors"];

export const defaultNewColor = "#0fffff";
export const maxIntervals = 7;
export const minIntervals = 3;

export const initializeSymbolization = ({
  mode,
  rampName,
  rampSize = 5,
  sortedData,
  property,
  unit,
  fallbackEndpoints = [0, 100],
  absValues = false,
  reverseRamp = false,
}: {
  rampName: string;
  rampSize?: number;
  mode: RangeMode;
  sortedData: number[];
  property: string;
  unit: Unit;
  fallbackEndpoints?: RampEndpoints;
  absValues?: boolean;
  reverseRamp?: boolean;
}): SymbolizationRamp => {
  const colors = getColors(rampName, rampSize, reverseRamp);
  const isValid = checkValidData(mode, sortedData, rampSize);
  let effectiveMode: RangeMode, stops;
  if (isValid) {
    effectiveMode = mode;
    stops = generateStops(mode, colors, sortedData, fallbackEndpoints);
  } else {
    effectiveMode = "manual";
    stops = generateStops("manual", colors, sortedData, fallbackEndpoints);
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
    stops,
    absValues,
    reversedRamp: reverseRamp,
  };
};

export const prependBreak = (
  symbolization: SymbolizationRamp,
): SymbolizationRamp => {
  const { stops } = symbolization;
  const [first, ...rest] = stops;
  const firstValue = first.input === -Infinity ? rest[0].input : first.input;
  const newValue = firstValue > 0 ? 0 : Math.floor(firstValue - 1);

  const newStops = [
    { input: first.input, output: defaultNewColor },
    {
      input: newValue,
      output: first.output,
    },
    ...rest,
  ];

  return { ...symbolization, mode: "manual", stops: newStops };
};

export const appendBreak = (
  symbolization: SymbolizationRamp,
): SymbolizationRamp => {
  const lastStop = symbolization.stops[symbolization.stops.length - 1];
  const newStops = [
    ...symbolization.stops,
    {
      input: Math.floor(lastStop.input + 1),
      output: defaultNewColor,
    },
  ];
  return { ...symbolization, mode: "manual", stops: newStops };
};

export const reverseColors = (symbolization: SymbolizationRamp) => {
  const colors = [...symbolization.stops].reverse().map((s) => s.output);
  const newStops = symbolization.stops.map((s, i) => ({
    input: s.input,
    output: colors[i],
  }));

  return {
    ...symbolization,
    reversedRamp: !symbolization.reversedRamp,
    stops: newStops,
  };
};

export const changeIntervalColor = (
  symbolization: SymbolizationRamp,
  index: number,
  color: string,
) => {
  const newStops = symbolization.stops.map((stop, i) => {
    if (i !== index) return stop;

    return { ...stop, output: color };
  });

  return { ...symbolization, stops: newStops };
};

export const validateAscendingOrder = (
  candidates: ISymbolizationRamp["stops"],
) => {
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].input < candidates[i - 1].input) {
      return false;
    }
  }
  return true;
};

export const updateBreakValue = (
  symbolization: SymbolizationRamp,
  index: number,
  value: number,
): SymbolizationRamp => {
  const newStops = symbolization.stops.map((stop, i) => {
    if (i !== index) return stop;

    return { ...stop, input: value };
  });

  return { ...symbolization, mode: "manual", stops: newStops };
};

export const deleteBreak = (
  symbolization: SymbolizationRamp,
  index: number,
): SymbolizationRamp => {
  let newStops;
  if (index === 1) {
    const [, target, ...rest] = symbolization.stops;
    newStops = [{ input: -Infinity, output: target.output }, ...rest];
  } else {
    newStops = symbolization.stops.filter((stop, i) => i !== index);
  }

  return {
    ...symbolization,
    stops: newStops,
  };
};

export const changeRampName = (
  symbolization: SymbolizationRamp,
  newRampName: string,
  isReversed: boolean,
) => {
  const colors = getColors(newRampName, symbolization.stops.length, isReversed);

  const newStops = symbolization.stops.map((stop, i) => ({
    input: stop.input,
    output: colors[i],
  }));

  return {
    ...symbolization,
    rampName: newRampName,
    reversedRamp: isReversed,
    stops: newStops,
  };
};

export const changeRangeSize = (
  symbolization: SymbolizationRamp,
  sortedValues: number[],
  rampSize: number,
): { symbolization: SymbolizationRamp; error?: boolean } => {
  const { mode, fallbackEndpoints, rampName } = symbolization;
  const valid = checkValidData(mode, sortedValues, rampSize);

  const colors = getColors(
    rampName,
    rampSize,
    Boolean(symbolization.reversedRamp),
  );

  const stops = valid
    ? generateStops(mode, colors, sortedValues, fallbackEndpoints)
    : Array.from({ length: rampSize }, (_, i) => ({
        input: i,
        output: colors[i],
      }));

  return {
    symbolization: { ...symbolization, stops },
    error: !valid,
  };
};

export const getColors = (
  rampName: string,
  rampSize: number,
  reverse: boolean,
): string[] => {
  const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === rampName)!;
  const colors = ramp.colors[rampSize as RampSize] as string[];
  return reverse ? [...colors].reverse() : colors;
};

export const applyMode = (
  symbolization: SymbolizationRamp,
  mode: RangeMode,
  sortedValues: number[],
): { symbolization: SymbolizationRamp; error?: boolean } => {
  const rampSize = symbolization.stops.length as RampSize;
  const valid = checkValidData(mode, sortedValues, rampSize);
  const stops = valid
    ? generateStops(
        mode,
        symbolization.stops.map((s) => s.output),
        sortedValues,
        symbolization.fallbackEndpoints,
      )
    : symbolization.stops;

  return {
    symbolization: { ...symbolization, mode, stops },
    error: !valid,
  };
};

const generateStops = (
  mode: RangeMode,
  colors: string[],
  sortedValues: number[],
  fallbackEndpoints: [number, number],
): SymbolizationRamp["stops"] => {
  let stopValues;
  if (mode === "prettyBreaks" || mode === "manual") {
    const breaks = calculateBreaks(
      mode,
      sortedValues,
      colors.length - 1,
      fallbackEndpoints,
    );
    stopValues = [-Infinity, ...breaks];
  } else {
    const breaks = calculateRange(mode, sortedValues, colors.length);
    stopValues = [-Infinity, ...breaks.slice(1, -1)];
  }
  if (stopValues.length !== colors.length)
    throw new Error("Invalid stops for ramp");

  return stopValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};

const calculateBreaks = (
  mode: RangeMode,
  sortedValues: number[],
  numIntervals: number,
  fallbackEndpoints: RampEndpoints,
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
};
