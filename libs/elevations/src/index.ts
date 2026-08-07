export type {
  BoundaryResult,
  CanvasSetupFn,
  CrsTransform,
  CrsUnit,
  ElevationFetchStatus,
  ElevationSource,
  ElevationTransform,
  FetchElevationsOptions,
  FetchProj4Def,
  GeoTiffElevationSource,
  GeoTiffTile,
  LinearUnit,
  LngLat,
  PixelTransform,
  Raster2D,
  TileCoverage,
  TileCoverageOptions,
  TileServerConfig,
  TileServerElevationSource,
} from "./types";

export type { ElevationEngine, ElevationGeoTiffCapability } from "./engine";
export { defaultElevationEngine } from "./engine";

export type {
  ElevationSourceErrorCode,
  ElevationSourceFailure,
} from "./errors";
export {
  ELEVATION_SOURCE_ERROR_NAME,
  asElevationSourceErrorCode,
  toElevationSourceFailure,
} from "./errors";

export type { Instrument } from "./tile-server";
export {
  browserCanvasSetup,
  buildTileDescriptor,
  decodeTerrainRGB,
  defaultTileServerConfig,
  fetchElevationForPoint,
  fetchTileFromUrl,
  getPixelDescriptor,
  lngLatToTile,
  offscreenCanvasSetup,
  prefetchElevationsTile,
  queryClient,
  readElevationFromPixels,
  resolveTileServerConfig,
  setTileFetchInstrument,
  tileSize,
  tileZoom,
} from "./tile-server";
