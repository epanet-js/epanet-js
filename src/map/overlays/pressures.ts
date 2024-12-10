import { ScatterplotLayer } from "@deck.gl/layers";
import { AssetId, AssetsMap, Junction } from "src/hydraulic-model";
import { ISymbolizationRamp } from "src/types";
import { parseHexColor } from "src/vendor/mapshaper/color/color-utils";

type Rgb = [number, number, number];

export const buildPressuresOverlay = (
  assets: AssetsMap,
  symbolization: ISymbolizationRamp,
  skipSet: Set<AssetId>,
) => {
  const steps = symbolization.stops.map((stop) => {
    return {
      value: stop.input,
      color: parseColor(stop.output),
    };
  });

  const colorFor = (value: number): number[] => {
    const step = steps.find((step) => value <= step.value);
    return step ? step.color : steps[steps.length - 1].color;
  };

  const data = [];
  for (const asset of assets.values()) {
    if (asset.type !== "junction" || skipSet.has(asset.id)) continue;

    data.push({
      color: colorFor((asset as Junction).pressure || 0),
      coordinates: asset.coordinates,
    });
  }

  return [
    new ScatterplotLayer({
      id: "analysis-pressures",
      data,
      getPosition: (d) => d.coordinates as [number, number],
      getRadius: 6,
      radiusUnits: "pixels",
      getFillColor: (d) => d.color as [number, number, number],
      pickable: false,
      antialiasing: true,
    }),
  ];
};

const parseColor = (color: string): Rgb => {
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
