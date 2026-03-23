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
} from "./geotiff-utils";
export type { ExtractedTileMetadata } from "./geotiff-utils";
