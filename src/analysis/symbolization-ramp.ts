import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { ISymbolizationRamp } from "src/types";
import {
  calculateEqualIntervalBreaks,
  calculateEqualQuantileBreaks,
  calculatePrettyBreaks,
  calculatePrettyBreaksAlt,
  calculateCkmeansBreaks,
} from "./modes";
import { Unit } from "src/quantity";

type SymbolizationRamp = ISymbolizationRamp;

export const rampModes = [
  "linear",
  "quantiles",
  "pretty",
  "pretty-alt",
  "ckmeans",
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
  if (symbolization.mode === "pretty") {
    const tryRampSize = (size: number): SymbolizationRamp => {
      const result = calculatePrettyBreaks(sortedValues, size - 1);
      const actualRampSize = result.breaks.length + 1;

      if (actualRampSize > maxRampSize) {
        // eslint-disable-next-line no-console
        console.log(
          `Too many breaks (${actualRampSize}), reducing from ${size} colors`,
        );

        if (size <= minRampSize) {
          throw new Error(
            `Pretty breaks algorithm would return too many breaks: ${actualRampSize}. Maximum allowed is ${maxRampSize} and minimum is ${minRampSize}`,
          );
        }

        return tryRampSize(size - 1);
      }

      const colors = getColors(
        symbolization.rampName,
        actualRampSize,
        Boolean(symbolization.reversedRamp),
      );

      const stops = generateStops(symbolization.mode, colors, sortedValues);
      return { ...symbolization, stops };
    };

    return tryRampSize(rampSize);
  }

  const colors = getColors(
    symbolization.rampName,
    rampSize,
    Boolean(symbolization.reversedRamp),
  );

  const stops = generateStops(symbolization.mode, colors, sortedValues);
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
  switch (mode) {
    case "linear":
      return generateLinearStops(sortedValues, colors);
    case "quantiles":
      return generateQuantileStops(sortedValues, colors);
    case "pretty":
      return generatePrettyStops(sortedValues, colors);
    case "pretty-alt":
      return generatePrettyStopsAlt(sortedValues, colors);
    case "ckmeans":
      return generateCkmeansStops(sortedValues, colors);
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

  // eslint-disable-next-line no-console
  console.log("generateQuantileStops newValues:", newValues);

  return newValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};

const generateCkmeansStops = (sortedValues: number[], colors: string[]) => {
  const startTime = performance.now();
  const breaks = calculateCkmeansBreaks(sortedValues, colors.length);
  const endTime = performance.now();
  // eslint-disable-next-line no-console
  console.log(`calculateCkmeansBreaks took ${endTime - startTime}ms`);
  const newValues = [-Infinity, ...breaks];
  if (newValues.length !== colors.length)
    throw new Error("Invalid stops for ramp");

  return newValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};

const generatePrettyStopsAlt = (sortedValues: number[], colors: string[]) => {
  const breaks = calculatePrettyBreaksAlt(sortedValues, colors.length - 1);
  //const breaks = calculatePrettyBreaksAlt2(sortedValues, colors.length - 1);

  const newValues = [-Infinity, ...breaks];
  if (newValues.length !== colors.length)
    throw new Error("Invalid stops for ramp");

  // eslint-disable-next-line no-console
  console.log("generatePrettyStopsAlt newValues:", newValues);

  return newValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: colors[i] };
  });
};
const generatePrettyStops = (sortedValues: number[], colors: string[]) => {
  const result = calculatePrettyBreaks(sortedValues, colors.length - 1);
  const breaks = result.breaks;

  if (breaks.length > maxRampSize) {
    // eslint-disable-next-line no-console
    console.log(
      `Too many breaks (${breaks.length}), reducing number of colors from ${colors.length}`,
    );

    if (colors.length <= minRampSize) {
      throw new Error(
        `Pretty breaks algorithm returned too many breaks: ${breaks.length}. Maximum allowed is ${maxRampSize} and minimum is ${minRampSize}`,
      );
    }

    return generatePrettyStops(
      sortedValues,
      colors.slice(0, colors.length - 1),
    );
  }

  const adjustedColors =
    breaks.length < colors.length
      ? colors.slice(0, breaks.length + 1)
      : [
          ...colors,
          ...Array(breaks.length - colors.length + 1).fill(
            colors[colors.length - 1],
          ),
        ];

  const newValues = [-Infinity, ...breaks];
  // eslint-disable-next-line no-console
  console.log("Generated values:", newValues, "with colors:", adjustedColors);

  if (newValues.length !== adjustedColors.length) {
    throw new Error("Invalid stops for ramp after adjustment");
  }

  return newValues.map((value, i) => {
    return { input: Number(value.toFixed(2)), output: adjustedColors[i] };
  });
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
  mode: "linear",
  stops: [],
};
