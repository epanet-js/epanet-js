import type { GeoTIFFImage } from "geotiff";
import type { GeoTiffTile } from "@epanet-js/elevations";

export type {
  CrsUnit,
  LinearUnit,
  PixelTransform,
  CrsTransform,
  ElevationTransform,
  TileCoverage,
  GeoTiffTile,
} from "@epanet-js/elevations";

/**
 * `GeoTiffTile.image` is `unknown` in the contract so the shared package carries
 * no raster-library dependency. Inside the engine it is always the handle this
 * engine put there.
 */
export type EngineTile = Omit<GeoTiffTile, "image"> & { image: GeoTIFFImage };

export const asEngineTile = (tile: GeoTiffTile): EngineTile =>
  tile as EngineTile;
