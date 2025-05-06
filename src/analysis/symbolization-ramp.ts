import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { ISymbolizationRamp } from "src/types";
import {
  calculateEqualIntervalBreaks,
  calculateEqualQuantileBreaks,
} from "./modes";

type SymbolizationRamp = ISymbolizationRamp;

export const rampModes = ["linear", "quantiles"] as const;
export type RampMode = (typeof rampModes)[number];

export type RampSize = keyof CBColors["colors"];

export const defaultNewColor = "#0fffff";
export const maxRampSize = 7;
export const minRampSize = 3;

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

  return { ...symbolization, stops: newStops };
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
  return { ...symbolization, stops: newStops };
};

export const reverseColors = (symbolization: SymbolizationRamp) => {
  const colors = [...symbolization.stops].reverse().map((s) => s.output);
  const newStops = symbolization.stops.map((s, i) => ({
    input: s.input,
    output: colors[i],
  }));

  return { ...symbolization, stops: newStops };
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
) => {
  const newStops = symbolization.stops.map((stop, i) => {
    if (i !== index) return stop;

    return { ...stop, input: value };
  });

  return { ...symbolization, stops: newStops };
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
) => {
  const colors = getColors(newRampName, symbolization.stops.length);

  const newStops = symbolization.stops.map((stop, i) => ({
    input: stop.input,
    output: colors[i],
  }));

  return { ...symbolization, rampName: newRampName, stops: newStops };
};

export const changeRampSize = (
  symbolization: SymbolizationRamp,
  sortedValues: number[],
  rampSize: number,
) => {
  const stops = generateStops(
    symbolization.mode,
    getColors(symbolization.rampName, rampSize),
    sortedValues,
  );
  return { ...symbolization, stops };
  const colors = getColors(symbolization.rampName, rampSize);

  const newStops: ISymbolizationRamp["stops"] = [];
  colors.forEach((color, index) => {
    if (symbolization.stops[index]) {
      newStops.push({
        input: symbolization.stops[index].input,
        output: color,
      });
    } else {
      const previous = newStops[newStops.length - 1];
      newStops.push({ input: Math.floor(previous.input + 1), output: color });
    }
  });

  return { ...symbolization, stops: newStops };
};

export const applyRampColors = (symbolization: SymbolizationRamp) => {
  const colors = getColors(symbolization.rampName, symbolization.stops.length);

  const newStops = symbolization.stops.map((stop, i) => {
    return { input: stop.input, output: colors[i] };
  });

  return { ...symbolization, stops: newStops };
};

export const getColors = (rampName: string, rampSize: number): string[] => {
  const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === rampName)!;
  return ramp.colors[rampSize as RampSize] as string[];
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
  switch (mode) {
    case "linear":
      return generateLinearStops(sortedValues, colors);
    case "quantiles":
      return generateQuantileStops(sortedValues, colors);
  }
};

const generateLinearStops = (sortedValues: number[], colors: string[]) => {
  const breaks = calculateEqualIntervalBreaks(sortedValues, colors.length - 1);

  const newValues = [-Infinity, ...breaks];
  if (newValues.length !== colors.length)
    throw new Error("Invalid stops for ramp");

  return newValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};

const generateQuantileStops = (sortedValues: number[], colors: string[]) => {
  const quantileBreaks = calculateEqualQuantileBreaks(
    sortedValues,
    colors.length - 1,
  );

  const newValues = [-Infinity, ...quantileBreaks];
  if (newValues.length !== colors.length)
    throw new Error("Invalid stops for ramp");

  return newValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};
