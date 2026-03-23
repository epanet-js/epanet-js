import { createProjectionTransformer } from "src/lib/geojson-utils/coordinate-transform";
import type { FeatureCollection, Feature, Position } from "geojson";

export const projectGeoJson = (
  geoJson: FeatureCollection,
  projectionCode: string,
): FeatureCollection => {
  const transform = createProjectionTransformer(projectionCode);

  return {
    ...geoJson,
    features: geoJson.features.map((feature: Feature) => {
      if (!feature.geometry) return feature;

      if (feature.geometry.type === "Point") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: transform(
              feature.geometry.coordinates as [number, number],
            ),
          },
        };
      }

      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map(
              (c) => transform(c as [number, number]) as Position,
            ),
          },
        };
      }

      return feature;
    }),
  };
};
