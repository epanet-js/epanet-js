import {
  type ElevationEngine,
  prefetchElevationsTile,
} from "@epanet-js/elevations";
import {
  fetchElevationFromSources,
  fetchElevationsFromSources,
} from "./fetch-elevation";
import {
  computeTileBoundaries,
  parseGeoTIFF,
  tileCoverage,
  tileResolution,
} from "./geotiff";

export const elevationEngine: ElevationEngine = {
  fetchElevation: fetchElevationFromSources,
  fetchElevations: fetchElevationsFromSources,
  prefetchTile: prefetchElevationsTile,
  supportsGeoTiff: true,
  geoTiff: {
    parse: parseGeoTIFF,
    computeBoundaries: computeTileBoundaries,
    coverage: tileCoverage,
    resolution: tileResolution,
  },
};
