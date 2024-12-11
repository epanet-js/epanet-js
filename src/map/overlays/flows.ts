import { GeoJsonLayer } from "@deck.gl/layers";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature, ISymbolizationRamp } from "src/types";
import { parseHexColor } from "src/vendor/mapshaper/color/color-utils";

type Rgb = [number, number, number];

export const buildFlowsOverlay = (
  assets: AssetsMap,
  symbolization: ISymbolizationRamp,
  conditionFn: (assetId: AssetId) => boolean,
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

  const data: Pipe[] = [];
  for (const asset of assets.values()) {
    if (
      asset.type !== "pipe" ||
      !conditionFn(asset.id) ||
      (asset as Pipe).flow === null
    )
      continue;

    data.push(asset as Pipe);
  }

  return [
    new GeoJsonLayer({
      id: "analysis-flows",
      data: data as unknown as IFeature[],
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 4,
      getFillColor: [0, 0, 0],
      getLineColor: (pipe) =>
        colorFor((pipe as unknown as Pipe).flow as number) as Rgb,
      getPointRadius: 4,
      lineCapRounded: true,
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
