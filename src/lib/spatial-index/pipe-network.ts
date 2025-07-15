import { FeatureCollection, LineString, feature } from "@turf/helpers";
import { AssetsMap } from "src/hydraulic-model";
import { Pipe } from "src/hydraulic-model/asset-types/pipe";

export function extractPipeNetwork(
  assets: AssetsMap,
): FeatureCollection<LineString> {
  const pipeFeatures: Array<GeoJSON.Feature<LineString>> = [];

  for (const [id, asset] of assets) {
    if (asset instanceof Pipe && asset.feature.geometry.type === "LineString") {
      const pipeFeature = feature(asset.feature.geometry as LineString, {
        pipeId: id,
        type: "pipe",
      });
      pipeFeatures.push(pipeFeature);
    }
  }

  return {
    type: "FeatureCollection",
    features: pipeFeatures,
  };
}
