export type {
  GeoTiffElevationSource,
  TileServerElevationSource,
  ElevationSource,
} from "./elevation-source-types";

export {
  fetchElevationFromSources,
  fetchElevationsFromSources,
} from "./fetch-elevation";

export {
  fetchElevationForPoint,
  fetchElevationsForPoints,
  prefetchElevationsTile,
  queryClient,
  tileSize,
  tileZoom,
} from "./tile-server-elevation";
export type {
  LngLat,
  CanvasSetupFn,
  TileServerConfig,
} from "./tile-server-elevation";
