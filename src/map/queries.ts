import { LngLatLike } from "mapbox-gl";
import { MapEngine } from "./map-engine";

export const getElevationAt = (mapEngine: MapEngine, lngLat: LngLatLike) => {
  return mapEngine.map.queryTerrainElevation(lngLat, {
    exaggerated: false,
  });
};
