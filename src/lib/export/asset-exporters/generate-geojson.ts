import { FeatureCollection, Geometry, Point } from "geojson";

const emptyGeometry: Point = {
  type: "Point",
  coordinates: [],
};

export const generateGeoJson = (data: object[]): FeatureCollection => {
  const featureCollection: FeatureCollection = {
    type: "FeatureCollection",
    features: [],
  };

  data.forEach((item) => {
    const geometry =
      "geometry" in item ? (item.geometry as Geometry) : emptyGeometry;
    const properties = { ...item };
    if ("geometry" in properties) {
      delete properties.geometry;
    }

    featureCollection.features.push({
      type: "Feature",
      geometry,
      properties,
    });
  });

  return featureCollection;
};
