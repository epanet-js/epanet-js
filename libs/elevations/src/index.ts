export type {
  BoundaryResult,
  CanvasSetupFn,
  ElevationFetchStatus,
  ElevationSource,
  FetchElevationsOptions,
  FetchProj4Def,
  GeoTiffElevationSource,
  GeoTiffTile,
  LinearUnit,
  LngLat,
  Raster2D,
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

export type { Instrument, TileFetchFailure } from "./tile-server";
export { TileFetchError, tileFetchFailureOf } from "./tile-server";
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

export type { FakeElevationEngineOverrides } from "./testing";
export { createFakeElevationEngine } from "./testing";
