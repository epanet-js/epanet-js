import { LngLatLike } from "mapbox-gl";
import { MapEngine } from "./map-engine";
import { isFeatureOn } from "src/infra/feature-flags";
import { withInstrumentation } from "src/infra/with-instrumentation";

export const getElevationAt = withInstrumentation(
  (mapEngine: MapEngine, lngLat: LngLatLike): number => {
    if (!isFeatureOn("FLAG_ELEVATIONS")) return 0;
    const elevationInMeters = mapEngine.map.queryTerrainElevation(lngLat, {
      exaggerated: false,
    });
    if (elevationInMeters === null) return 0;

    return parseFloat(elevationInMeters.toFixed(2));
  },
  { name: "MAP_QUERY:GET_ELEVATION", maxDurationMs: 100 },
);
