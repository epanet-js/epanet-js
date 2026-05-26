import type { FeatureCollection, Feature, Position } from "geojson";

const METERS_PER_DEGREE = 111_320;

export function approximateToNullIsland(
  geoJSON: FeatureCollection,
): FeatureCollection {
  let minX = Infinity;
  let minY = Infinity;

  const extractCoords = (coords: Position) => {
    if (coords[0] < minX) minX = coords[0];
    if (coords[1] < minY) minY = coords[1];
  };

  for (const feature of geoJSON.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type === "Point") {
      extractCoords(feature.geometry.coordinates);
    } else if (feature.geometry.type === "LineString") {
      feature.geometry.coordinates.forEach(extractCoords);
    }
  }

  const transform = (coord: Position): Position => [
    (coord[0] - minX) / METERS_PER_DEGREE,
    (coord[1] - minY) / METERS_PER_DEGREE,
  ];

  return {
    ...geoJSON,
    features: geoJSON.features.map((feature: Feature) => {
      if (!feature.geometry) return feature;
      if (feature.geometry.type === "Point") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: transform(feature.geometry.coordinates),
          },
        };
      }
      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map(transform),
          },
        };
      }
      return feature;
    }),
  };
}
