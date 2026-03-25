import type { GeoTIFFImage } from "geotiff";

export type GeoTiffTile = {
  id: string;
  file: File;
  width: number;
  height: number;
  bbox: [number, number, number, number];
  pixelToCrs: number[];
  crsToPixel: number[];
  noDataValue: number | null;
  /** Lightweight handle — holds a reference to the File blob, no raster in memory. */
  image: GeoTIFFImage;
  /** Computed data boundary — replaces bbox for display when present. */
  coveragePolygon?: GeoJSON.Geometry;
  /** Pixel resolution [scaleX, scaleY] in CRS units (degrees for WGS84, meters/feet for projected). */
  resolution: [number, number];
  /** proj4 definition string for the file's CRS. Absent if WGS84. */
  proj4Def?: string;
  /** Horizontal unit of the CRS. */
  crsUnit: "deg" | "m" | "ft" | "us-ft";
  /** Vertical/elevation unit (from VerticalUnitsGeoKey). Always linear — defaults to "m". */
  verticalUnit: "m" | "ft" | "us-ft";
  /** Z-scaling factor from ModelPixelScale. 0 or 1 means no scaling. */
  scaleZ?: number;
  /** True if GTRasterTypeGeoKey = PixelIsPoint (2). Affects pixel ↔ CRS mapping. */
  pixelIsPoint?: boolean;
};

export type GeoTiffElevationSource = {
  type: "geotiff";
  id: string;
  enabled: boolean;
  tiles: GeoTiffTile[];
  elevationOffsetM: number;
};

export type TileServerElevationSource = {
  type: "tile-server";
  id: string;
  enabled: boolean;
  tileUrlTemplate: string;
  tileZoom: number;
  tileSize: number;
  encoding: "terrain-rgb";
  elevationOffsetM: number;
};

export type ElevationSource =
  | GeoTiffElevationSource
  | TileServerElevationSource;
