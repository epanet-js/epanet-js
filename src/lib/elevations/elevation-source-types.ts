import type { GeoTIFFImage } from "geotiff";

export type GeoTiffTile = {
  id: string;
  file: File;
  width: number;
  height: number;
  bbox: [number, number, number, number];
  pixelToGps: number[];
  gpsToPixel: number[];
  noDataValue: number | null;
  /** Lightweight handle — holds a reference to the File blob, no raster in memory. */
  image: GeoTIFFImage;
};

export type GeoTiffElevationSource = {
  type: "geotiff";
  id: string;
  enabled: boolean;
  name: string;
  tiles: GeoTiffTile[];
  elevationOffsetM: number;
};

export type TileServerElevationSource = {
  type: "tile-server";
  id: string;
  enabled: boolean;
  name: string;
  tileUrlTemplate: string;
  tileZoom: number;
  tileSize: number;
  encoding: "terrain-rgb";
  elevationOffsetM: number;
};

export type ElevationSource =
  | GeoTiffElevationSource
  | TileServerElevationSource;
