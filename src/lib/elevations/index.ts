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
  getGeoTiffGridResolutionM,
} from "./geotiff-utils";
export type { ExtractedTileMetadata } from "./geotiff-utils";

export { fetchElevationFromSources } from "./fetch-elevation";

export {
  fetchElevationForPoint,
  prefetchElevationsTile,
  queryClient,
  tileSize,
  tileZoom,
} from "./tile-server-elevation";
export type { LngLat, CanvasSetupFn } from "./tile-server-elevation";
