import { MapEngine } from "./map-engine";
import { MapboxGeoJSONFeature, Point, PointLike } from "mapbox-gl";
import { LayerId } from "./layers";

export const searchNearbyRenderedFeatures = (
  map: MapEngine,
  {
    point,
    distance = 12,
    layers,
  }: { point: Point; distance?: number; layers: LayerId[] },
): MapboxGeoJSONFeature[] => {
  const { x, y } = point;

  const searchBox = [
    [x - distance, y - distance] as PointLike,
    [x + distance, y + distance] as PointLike,
  ] as [PointLike, PointLike];

  const features = map.queryRenderedFeatures(searchBox, {
    layers: layers as unknown as string[],
  });
  return features;
};
