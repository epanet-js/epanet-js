export type {
  GeoTiffElevationSource,
  TileServerElevationSource,
  ElevationSource,
} from "./elevation-source-types";

export { fetchElevationFromSources } from "./fetch-elevation";

export {
  fetchElevationForPoint,
  prefetchElevationsTile,
  queryClient,
  tileSize,
  tileZoom,
} from "./tile-server-elevation";
export type { LngLat, CanvasSetupFn } from "./tile-server-elevation";
