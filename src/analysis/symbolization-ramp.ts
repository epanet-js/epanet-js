import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { ISymbolizationRamp } from "src/types";
import {
  calculateCkmeansBreaks,
  calculateEqualIntervalBreaks,
  calculateEqualQuantileBreaks,
  calculatePrettyBreaks,
} from "./ramp-modes";
import { Unit } from "src/quantity";

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

export const deleteStop = (symbolization: SymbolizationRamp, index: number) => {
  let newStops;
  if (index === 1) {
    const [, target, ...rest] = symbolization.stops;
    newStops = [{ input: -Infinity, output: target.output }, ...rest];
  } else {
    newStops = symbolization.stops.filter((stop, i) => i !== index);
  }

  return { ...symbolization, stops: newStops };
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
) => {
  const stops = generateStops(
    symbolization.mode,
    getColors(
      symbolization.rampName,
      rampSize,
      Boolean(symbolization.reversedRamp),
    ),
    sortedValues,
  );
  return { ...symbolization, stops };
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
): SymbolizationRamp => {
  const stops = generateStops(
    mode,
    symbolization.stops.map((s) => s.output),
    sortedValues,
  );
  return { ...symbolization, mode, stops };
};

const generateStops = (
  mode: RampMode,
  colors: string[],
  sortedValues: number[],
): SymbolizationRamp["stops"] => {
  const breaks = generateBreaks(mode, sortedValues, colors.length - 1);
  const stopValues = [-Infinity, ...breaks];
  if (stopValues.length !== colors.length)
    throw new Error("Invalid stops for ramp");

  return stopValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};

const generateBreaks = (
  mode: RampMode,
  sortedValues: number[],
  numBreaks: number,
): number[] => {
  switch (mode) {
    case "equalIntervals":
      return calculateEqualIntervalBreaks(sortedValues, numBreaks);
    case "equalQuantiles":
      return calculateEqualQuantileBreaks(sortedValues, numBreaks);
    case "prettyBreaks":
      return calculatePrettyBreaks(sortedValues, numBreaks);
    case "ckmeans":
      return calculateCkmeansBreaks(sortedValues, numBreaks);
    case "manual":
      return calculateEqualIntervalBreaks(sortedValues, numBreaks);
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
