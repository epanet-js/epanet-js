import type { IFeature, Feature, LineString } from "src/types";

export function fixDegenerates(feature: Feature) {
  if (feature.geometry?.type === "Polygon") {
    const ring = feature.geometry.coordinates[0];
    if (
      ring.length < 3 ||
      // Drawing a polygon - first and last coordinate are the same
      (ring.length === 3 &&
        ring[0][0] === ring[2][0] &&
        ring[0][1] === ring[2][1])
    ) {
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: feature.geometry.coordinates[0],
        },
      } as IFeature<LineString>;
    }
  }
  return feature;
}
