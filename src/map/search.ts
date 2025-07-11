import { MapEngine } from "./map-engine";
import type { MapboxGeoJSONFeature, Point } from "mapbox-gl";
import { LayerId } from "./layers";

export const searchNearbyRenderedFeatures = (
  map: MapEngine,
  {
    point,
    distance = 12,
    layers,
  }: { point: Point; distance?: number; layers: LayerId[] },
): MapboxGeoJSONFeature[] => {
  return map.searchNearbyRenderedFeatures({ point, distance, layers });
};
