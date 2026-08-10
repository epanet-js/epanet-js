export type {
  GeoTiffElevationSource,
  TileServerElevationSource,
  ElevationSource,
  ElevationFetchStatus,
  FetchElevationsOptions,
  LngLat,
  CanvasSetupFn,
  TileServerConfig,
  GeoTiffTile,
  BoundaryResult,
  LinearUnit,
} from "@epanet-js/elevations";

export { queryClient, tileSize, tileZoom } from "@epanet-js/elevations";

export { getElevationEngine, registerElevationEngine } from "./registry";
