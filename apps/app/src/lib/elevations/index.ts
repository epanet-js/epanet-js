export type {
  GeoTiffElevationSource,
  TileServerElevationSource,
  ElevationSource,
  ElevationFetchStatus,
  FetchElevationsOptions,
  LngLat,
  CanvasSetupFn,
  TileServerConfig,
} from "@epanet-js/elevations";

export {
  fetchElevationForPoint,
  prefetchElevationsTile,
  queryClient,
  tileSize,
  tileZoom,
} from "@epanet-js/elevations";

export {
  fetchElevationFromSources,
  fetchElevationsFromSources,
} from "./fetch-elevation";

export { fetchElevationsForPoints } from "./tile-server-elevation";
