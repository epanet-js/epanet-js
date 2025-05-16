import { Unit } from "src/quantity";
import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { colors } from "src/lib/constants";
import { strokeColorFor } from "src/lib/color";
import { RangeEndpoints, SymbolizationRamp } from "./symbolization-ramp";

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
    const ranges = buildRanges(steps);
    const symbolization = buildSymbolization(
      paletteName,
      steps,
      property,
      unit,
      absoluteValues,
      [0, 100],
    );
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

  static fromSymbolizationRamp(symbolization: SymbolizationRamp) {
    const ranges = buildRanges([
      ...symbolization.stops.map((s) => s.input),
      Infinity,
    ]);
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
  public readonly symbolization: SymbolizationRamp;
  private rgbRamp: Rgb[];
  private colorRamp: string[];
  private strokeRamp: string[];
  public readonly absoluteValues: boolean;

  constructor(
    ranges: Range[],
    symbolization: SymbolizationRamp,
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
  fallbackEndpoints: RangeEndpoints,
): SymbolizationRamp => ({
  type: "ramp",
  simplestyle: true,
  property,
  unit,
  defaultColor: colors.indigo900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName,
  mode: "equalIntervals",
  stops: generateRampStops(rampName, steps),
  absValues,
  fallbackEndpoints,
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
  return stops as SymbolizationRamp["stops"];
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
