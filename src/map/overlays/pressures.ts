import { ScatterplotLayer } from "@deck.gl/layers";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { AssetId, AssetsMap, Junction } from "src/hydraulic-model";

export const buildPressuresOverlay = (
  assets: AssetsMap,
  rangeColorMapping: RangeColorMapping,
  conditionFn: (assetId: AssetId) => boolean,
) => {
  const data: Junction[] = [];
  for (const asset of assets.values()) {
    if (
      asset.type !== "junction" ||
      !conditionFn(asset.id) ||
      (asset as Junction).pressure === null
    )
      continue;

    data.push(asset as Junction);
  }

  return [
    new ScatterplotLayer({
      id: "analysis-pressures",
      data,
      getPosition: (junction: Junction) =>
        junction.coordinates as [number, number],
      getRadius: 6,
      radiusUnits: "pixels",
      getFillColor: (junction: Junction) =>
        rangeColorMapping.colorFor(junction.pressure as number),
      pickable: false,
      antialiasing: true,
    }),
  ];
};
