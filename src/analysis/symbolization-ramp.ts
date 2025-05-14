import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { ISymbolizationRamp } from "src/types";
import { calculatePrettyBreaks, checkValidData } from "./ramp-modes";
import { Unit } from "src/quantity";
import { calculateEqualIntervalRange } from "./ramp-modes/equal-intervals";
import { calculateEqualQuantilesRange } from "./ramp-modes/equal-quantiles";
import { calculateCkmeansRange } from "./ramp-modes/ckmeans";

type SymbolizationRamp = ISymbolizationRamp;

export const rampModes = [
  "equalIntervals",
  "equalQuantiles",
  "prettyBreaks",
  "ckmeans",
  "manual",
] as const;
export type RampMode = (typeof rampModes)[number];

export type RampSize = keyof CBColors["colors"];

export const defaultNewColor = "#0fffff";
export const maxRampSize = 7;
export const minRampSize = 3;

export const initializeSymbolization = ({
  mode,
  rampName,
  rampSize,
  sortedValues,
  property,
  unit,
  absValues = false,
  reverseRamp = false,
}: {
  rampName: string;
  rampSize: number;
  mode: RampMode;
  sortedValues: number[];
  property: string;
  unit: Unit;
  absValues?: boolean;
  reverseRamp?: boolean;
}): SymbolizationRamp => {
  const colors = getColors(rampName, rampSize, reverseRamp);
  const stops = generateStops(mode, colors, sortedValues);

  return {
    type: "ramp",
    simplestyle: true,
    property,
    unit,
    defaultColor: "",
    defaultOpacity: 0.3,
    interpolate: "step",
    rampName,
    mode,
    stops,
    absValues,
    reversedRamp: reverseRamp,
  };
};

export const prependStop = (
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

export const appendStop = (
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

export const changeStopColor = (
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

export const changeStopValue = (
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

export const deleteStop = (
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

export const changeRampSize = (
  symbolization: SymbolizationRamp,
  sortedValues: number[],
  rampSize: number,
): { symbolization: SymbolizationRamp; error?: boolean } => {
  const valid = checkValidData(symbolization.mode, sortedValues, rampSize);

  const colors = getColors(
    symbolization.rampName,
    rampSize,
    Boolean(symbolization.reversedRamp),
  );

  const stops = valid
    ? generateStops(symbolization.mode, colors, sortedValues)
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
  mode: RampMode,
  sortedValues: number[],
): { symbolization: SymbolizationRamp; error?: boolean } => {
  const rampSize = symbolization.stops.length as RampSize;
  const valid = checkValidData(mode, sortedValues, rampSize);
  const stops = valid
    ? generateStops(
        mode,
        symbolization.stops.map((s) => s.output),
        sortedValues,
      )
    : symbolization.stops;

  return {
    symbolization: { ...symbolization, mode, stops },
    error: !valid,
  };
};

const generateStops = (
  mode: RampMode,
  colors: string[],
  sortedValues: number[],
): SymbolizationRamp["stops"] => {
  let stopValues;
  if (mode === "prettyBreaks") {
    const breaks = calculatePrettyBreaks(sortedValues, colors.length - 1);
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

const calculateRange = (
  mode: RampMode,
  sortedValues: number[],
  numIntervals: number,
): number[] => {
  switch (mode) {
    case "equalIntervals":
      return calculateEqualIntervalRange(sortedValues, numIntervals);
    case "equalQuantiles":
      return calculateEqualQuantilesRange(sortedValues, numIntervals);
    case "manual":
      return calculateEqualIntervalRange(sortedValues, numIntervals);
    case "ckmeans":
      return calculateCkmeansRange(sortedValues, numIntervals);
    case "prettyBreaks":
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
};
