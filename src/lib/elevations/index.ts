export { computeTileBoundaries } from "./compute-boundary";

export type { BoundaryResult } from "./compute-boundary";

export type {
  GeoTiffTile,
  GeoTiffElevationSource,
  TileServerElevationSource,
  ElevationSource,
} from "./elevation-source-types";

export {
  extractGeoTiffMetadata,
  sampleElevation,
  isPointInBbox,
  transformCoordinates,
  buildCoverageFeature,
  getGeoTiffGridResolution,
} from "./geotiff-utils";
export type {
  ExtractedTileMetadata,
  GetProj4Def,
  UnsupportedProjectionInfo,
} from "./geotiff-utils";
export { UnsupportedProjectionError } from "./geotiff-utils";

export { fetchElevationFromSources } from "./fetch-elevation";

export {
  fetchElevationForPoint,
  prefetchElevationsTile,
  queryClient,
  tileSize,
  tileZoom,
} from "./tile-server-elevation";
export type { LngLat, CanvasSetupFn } from "./tile-server-elevation";
