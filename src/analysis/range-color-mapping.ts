import { Unit } from "src/quantity";
import { CBColors, COLORBREWER_ALL } from "src/lib/colorbrewer";
import { indigo900 } from "src/lib/constants";
import { ISymbolizationRamp } from "src/types";
import { parseHexColor } from "src/vendor/mapshaper/color/color-utils";

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
    );
    const rgbRamp = symbolization.stops.map((s) => {
      return parseRgb(s.output);
    });
    return new RangeColorMapping(
      ranges,
      symbolization,
      rgbRamp,
      absoluteValues,
    );
  }

  private ranges: Range[];
  public readonly symbolization: ISymbolizationRamp;
  private rgbRamp: Rgb[];
  private absoluteValues: boolean;

  constructor(
    ranges: Range[],
    symbolization: ISymbolizationRamp,
    rgbRamp: Rgb[],
    absoluteValues: boolean,
  ) {
    this.ranges = ranges;
    this.symbolization = symbolization;
    this.rgbRamp = rgbRamp;
    this.absoluteValues = absoluteValues;
  }

  colorFor(value: number): Rgb {
    const effectiveValue = this.absoluteValues ? Math.abs(value) : value;
    const range = this.ranges.find(
      ([start, end]) => start <= effectiveValue && effectiveValue < end,
    ) as Range;
    const index = this.ranges.indexOf(range);
    return this.rgbRamp[index];
  }

  hexaColor(value: number): string {
    const rgb = this.colorFor(value);

    const [r, g, b] = rgb;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}

const toHex = (value: number) => value.toString(16).padStart(2, "0");

const buildRanges = (steps: number[]) => {
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

const parseRgb = (color: string): Rgb => {
  if (color.startsWith("#")) {
    const parsed = parseHexColor(color);
    if (parsed === null) throw new Error(`Invalid color ${color}`);
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
): ISymbolizationRamp => ({
  type: "ramp",
  simplestyle: true,
  property,
  unit,
  defaultColor: indigo900,
  defaultOpacity: 0.3,
  interpolate: "step",
  rampName,
  stops: generateRampStops(rampName, steps),
});

const generateRampStops = (name: string, steps: number[]) => {
  const ramp = COLORBREWER_ALL.find((ramp) => ramp.name === name);
  if (!ramp) throw new Error("Ramp not found!");

  const stops = ramp.colors[steps.length as keyof CBColors["colors"]]?.map(
    (color: string, i: number) => {
      return { input: steps[i], output: color };
    },
  );
  return stops as ISymbolizationRamp["stops"];
};
