import type { FeatureCollection, Feature } from "geojson";
import type { Projection } from "./projection";
import { createProjectionMapper } from "./projection-mapper";

export const inverseProjectGeoJson = (
  geoJson: FeatureCollection,
  projection: Projection,
): FeatureCollection => {
  const mapper = createProjectionMapper(projection);

  return {
    ...geoJson,
    features: geoJson.features.map((feature: Feature) => {
      if (!feature.geometry) return feature;

      if (feature.geometry.type === "Point") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: mapper.toSource(
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
            coordinates: feature.geometry.coordinates.map((c) =>
              mapper.toSource(c as [number, number]),
            ),
          },
        };
      }

      return feature;
    }),
  };
};
