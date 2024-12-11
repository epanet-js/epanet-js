import { GeoJsonLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Pipe } from "src/hydraulic-model";
import { IFeature } from "src/types";
import { slots } from "../slots";

export const buildFlowsOverlay = (
  assets: AssetsMap,
  rangeColorMapping: RangeColorMapping,
  conditionFn: (assetId: AssetId) => boolean,
) => {
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
      beforeId: slots["after-lines-slot"],
      data: data as unknown as IFeature[],
      lineWidthUnits: "pixels",
      pointRadiusUnits: "pixels",
      getLineWidth: 5,
      getFillColor: [0, 0, 0],
      getLineColor: (pipe) =>
        rangeColorMapping.colorFor(
          Math.abs((pipe as unknown as Pipe).flow as number),
        ),
      getPointRadius: 4,
      lineCapRounded: true,
      antialiasing: true,
    }),
  ];
};
