import type { GeoTIFFImage } from "geotiff";

export type CrsUnit = "deg" | "m" | "ft" | "us-ft";
export type LinearUnit = "m" | "ft" | "us-ft";

/** Transform 1: Pixel ↔ CRS (affine matrix from GeoTIFF metadata) */
export type PixelTransform = {
  /** Affine matrix: pixel (col, row) → CRS coordinates */
  pixelToCrs: number[];
  /** Inverse affine matrix: CRS coordinates → pixel (col, row) */
  crsToPixel: number[];
  /** Pixel resolution [scaleX, scaleY] in CRS units */
  resolution: [number, number];
  /** True if GTRasterTypeGeoKey = PixelIsPoint (2). Already baked into the matrices. */
  pixelIsPoint?: boolean;
};

/** Transform 2: CRS ↔ WGS84 (proj4 reprojection) */
export type CrsTransform = {
  /** proj4 definition string. Absent if already WGS84. */
  proj4Def?: string;
  /** Horizontal unit of the CRS. */
  crsUnit: CrsUnit;
};

/** Transform 3: Raw pixel value → Elevation in known units */
export type ElevationTransform = {
  /** Raw pixel value representing no data. */
  noDataValue: number | null;
  /** Vertical/elevation unit. Always linear — defaults to "m". */
  verticalUnit: LinearUnit;
  /** GDAL band scale. Applied as: value = raw * gdalScale + gdalOffset. */
  gdalScale?: number;
  /** GDAL band offset. Applied as: value = raw * gdalScale + gdalOffset. */
  gdalOffset?: number;
  /** Z-scaling factor from ModelPixelScale. Applied after GDAL scale/offset. */
  scaleZ?: number;
};

export type TileCoverage = {
  width: number;
  height: number;
  /** Bounding box in WGS84 [west, south, east, north]. */
  bbox: [number, number, number, number];
  /** Computed data boundary — replaces bbox for display when present. */
  coveragePolygon?: GeoJSON.Geometry;
};

export type GeoTiffTile = {
  id: string;
  file: File;
  /** Lightweight handle — holds a reference to the File blob, no raster in memory. */
  image: GeoTIFFImage;
} & TileCoverage &
  PixelTransform &
  CrsTransform &
  ElevationTransform;
