import { Unit } from "src/quantity";
import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { colors } from "src/lib/constants";
import { ISymbolizationRamp } from "src/types";
import { strokeColorFor } from "src/lib/color";
import { isFeatureOn } from "src/infra/feature-flags";

export type Rgb = [number, number, number];
type Range = [start: number, end: number];

export class RangeColorMapping {
  static build({
    steps,
    property,
    paletteName,
    unit,
    absoluteValues = false,
  }: {
    steps: number[];
    property: string;
    paletteName: string;
    unit: Unit;
    absoluteValues?: boolean;
  }) {
    const ranges = isFeatureOn("FLAG_CUSTOMIZE")
      ? buildRanges(steps)
      : buildRangesDeprecated(steps);
    const symbolization = isFeatureOn("FLAG_CUSTOMIZE")
      ? buildSymbolization(paletteName, steps, property, unit, absoluteValues)
      : buildSymbolizationDeprecated(paletteName, steps, property, unit);
    const rgbRamp = symbolization.stops.map((s) => {
      return parseRgb(s.output);
    });
    const colorRamp = symbolization.stops.map((s) => s.output);
    const strokeRamp = symbolization.stops.map((s) => strokeColorFor(s.output));
    return new RangeColorMapping(
      ranges,
      symbolization,
      rgbRamp,
      colorRamp,
      strokeRamp,
      absoluteValues,
    );
  }

  static fromSymbolizationRamp(symbolization: ISymbolizationRamp) {
    const ranges = isFeatureOn("FLAG_CUSTOMIZE")
      ? buildRanges([...symbolization.stops.map((s) => s.input), Infinity])
      : buildRangesDeprecated(symbolization.stops.map((s) => s.input));
    const rgbRamp = symbolization.stops.map((s) => {
      return parseRgb(s.output);
    });
    const colorRamp = symbolization.stops.map((s) => s.output);
    const strokeRamp = symbolization.stops.map((s) => strokeColorFor(s.output));
    const absoluteValues = Boolean(symbolization.absValues);

    return new RangeColorMapping(
      ranges,
      symbolization,
      rgbRamp,
      colorRamp,
      strokeRamp,
      absoluteValues,
    );
  }

  static asNull() {
    return RangeColorMapping.build({
      steps: [],
      property: "",
      paletteName: "Temps",
      unit: null,
      absoluteValues: false,
    });
  }

  private ranges: Range[];
  public readonly symbolization: ISymbolizationRamp;
  private rgbRamp: Rgb[];
  private colorRamp: string[];
  private strokeRamp: string[];
  public readonly absoluteValues: boolean;

  constructor(
    ranges: Range[],
    symbolization: ISymbolizationRamp,
    rgbRamp: Rgb[],
    colorRamp: string[],
    strokeRamp: string[],
    absoluteValues: boolean,
  ) {
    this.ranges = ranges;
    this.symbolization = symbolization;
    this.rgbRamp = rgbRamp;
    this.colorRamp = colorRamp;
    this.strokeRamp = strokeRamp;
    this.absoluteValues = absoluteValues;
  }

  colorFor(value: number): Rgb {
    const index = this.findIndex(value);
    return this.rgbRamp[index];
  }

  hexaColor(value: number): string {
    const index = this.findIndex(value);
    return this.colorRamp[index];
  }

  strokeColor(value: number): string {
    const index = this.findIndex(value);
    return this.strokeRamp[index];
  }

  private findIndex(value: number) {
    const effectiveValue = this.absoluteValues ? Math.abs(value) : value;
    const range = this.ranges.find(
      ([start, end]) => start <= effectiveValue && effectiveValue < end,
    ) as Range;
    const index = this.ranges.indexOf(range);
    return index;
  }
}

const buildRanges = (steps: number[]) => {
  const ranges: Range[] = [];
  for (let i = 0; i < steps.length; i++) {
    ranges.push([steps[i], steps[i + 1]]);
  }
  return ranges;
};

const buildRangesDeprecated = (steps: number[]) => {
  const ranges: Range[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (i === 0) {
      ranges.push([-Infinity, steps[i + 1]]);
      continue;
    }

    if (i == steps.length - 1) {
      ranges.push([steps[i], Infinity]);
      continue;
    }

    ranges.push([steps[i], steps[i + 1]]);
  }
  return ranges;
};

export const parseRgb = (color: string): Rgb => {
  if (color.startsWith("#")) {
    const parsed = colorfulHexToRgbaObject(color);
    if (parsed === null) {
      return [0, 0, 0];
    }
    const { r, g, b } = parsed;
    return [r, g, b];
  }

  if (color.startsWith("rgb")) {
    return color
      .replace("rgb(", "")
      .replace(")", "")
      .split(",")
      .map((value) => parseInt(value.trim())) as Rgb;
  }

  throw new Error(`Color is not supported ${color}`);
};

const buildSymbolization = (
  rampName: string,
  steps: number[],
  property: string,
  unit: Unit,
  absValues: boolean,
): ISymbolizationRamp => ({
  type: "ramp",
  simplestyle: true,
  property,
  unit,
  defaultColor: colors.indigo900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName,
  mode: "linear",
  stops: generateRampStops(rampName, steps),
  absValues,
});

const generateRampStops = (name: string, steps: number[]) => {
  const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === name);
  if (!ramp) throw new Error("Ramp not found!");

  const rampSize = steps.length - 1;
  const stops = ramp.colors[rampSize as keyof CBColors["colors"]]?.map(
    (color: string, i: number) => {
      return { input: steps[i], output: color };
    },
  );
  return stops as ISymbolizationRamp["stops"];
};

const buildSymbolizationDeprecated = (
  rampName: string,
  steps: number[],
  property: string,
  unit: Unit,
): ISymbolizationRamp => ({
  type: "ramp",
  simplestyle: true,
  property,
  unit,
  defaultColor: colors.indigo900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName,
  mode: "linear",
  stops: generateRampStopsDeprecated(rampName, steps),
});

const generateRampStopsDeprecated = (name: string, steps: number[]) => {
  const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === name);
  if (!ramp) throw new Error("Ramp not found!");

  const stops = ramp.colors[steps.length as keyof CBColors["colors"]]?.map(
    (color: string, i: number) => {
      return { input: steps[i], output: color };
    },
  );
  return stops as ISymbolizationRamp["stops"];
};

interface RgbaObject {
  r: number;
  g: number;
  b: number;
  a: number;
}

function colorfulHexToRgbaObject(hexString: string): RgbaObject | null {
  if (!hexString) {
    return null;
  }

  let hex = hexString.trim().toLowerCase();

  if (hex.startsWith("#")) {
    hex = hex.slice(1);
  }

  const hexLength = hex.length;

  if (hexLength === 1) {
    const val = parseInt(hex + hex, 16);
    return { r: val, g: val, b: val, a: 1 };
  } else if (hexLength === 2) {
    const val = parseInt(hex, 16);
    return { r: val, g: val, b: val, a: 1 };
  } else if (hexLength === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b, a: 1 };
  } else if (hexLength === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = Math.round(parseInt(hex[3] + hex[3], 16) / 2.55) / 100;
    return { r, g, b, a };
  } else if (hexLength === 5) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex[2] + hex[2], 16);
    const b = parseInt(hex[3] + hex[3], 16);
    const a = Math.round(parseInt(hex[4] + hex[4], 16) / 2.55) / 100;
    return { r, g, b, a };
  } else if (hexLength === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { r, g, b, a: 1 };
  } else if (hexLength === 7) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a =
      Math.round(parseInt(hex.slice(6, 7) + hex.slice(6, 7), 16) / 2.55) / 100;
    return { r, g, b, a };
  } else if (hexLength === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = parseInt(hex.slice(6, 8), 16) / 255;
    return { r, g, b, a };
  }

  return null;
}
