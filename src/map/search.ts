import { MapEngine } from "./map-engine";
import type { MapboxGeoJSONFeature, Point } from "mapbox-gl";
import { LayerId } from "./layers";

export const DEFAULT_SNAP_DISTANCE_PIXELS = 12;

export const searchNearbyRenderedFeatures = (
  map: MapEngine,
  {
    point,
    distance = DEFAULT_SNAP_DISTANCE_PIXELS,
    layers,
  }: { point: Point; distance?: number; layers: LayerId[] },
): MapboxGeoJSONFeature[] => {
  return map.searchNearbyRenderedFeatures({ point, distance, layers });
};
