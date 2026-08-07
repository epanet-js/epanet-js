import { elevationEngine } from "./engine";
import { registerElevationEngine } from "./registry";

registerElevationEngine(elevationEngine);

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

export { queryClient, tileSize, tileZoom } from "@epanet-js/elevations";

export { getElevationEngine, registerElevationEngine } from "./registry";
