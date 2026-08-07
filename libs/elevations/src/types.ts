export type LngLat = { lat: number; lng: number };

export type CrsUnit = "deg" | "m" | "ft" | "us-ft";
export type LinearUnit = "m" | "ft" | "us-ft";

/**
 * The 2D raster surface the tile decoder needs. Declared structurally rather
 * than as `CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D`:
 * those two are not mutually assignable (their `.canvas` differs), and the
 * decoder only ever calls these two methods.
 */
export type Raster2D = Pick<
  CanvasRenderingContext2D,
  "drawImage" | "getImageData"
>;

export type CanvasSetupFn = (
  blob: Blob,
  size: number,
) => Promise<{ img: CanvasImageSource; ctx: Raster2D }>;

export type TileServerConfig = {
  tileUrlTemplate: string;
  tileZoom: number;
  tileSize: number;
};

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
  /**
   * Opaque handle owned by the engine that produced this tile — a lightweight
   * reference to the `File` blob, no raster in memory. Typed `unknown` so this
   * package carries no raster-library dependency; the engine narrows it.
   */
  image: unknown;
} & TileCoverage &
  PixelTransform &
  CrsTransform &
  ElevationTransform;

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

/** What the fetch is working on right now, for a live status line. */
export type ElevationFetchStatus =
  | { kind: "tile-server"; completed: number; total: number }
  | { kind: "geotiff"; fileName: string };

export type FetchElevationsOptions = {
  /** Cumulative resolved points against the total, as tiles/buckets complete. */
  onProgress?: (resolved: number, total: number) => void;
  /** The tile/file currently being processed, so a stall is legible. */
  onStatus?: (status: ElevationFetchStatus) => void;
  /** Aborts between tiles/buckets; already-resolved points are kept. */
  signal?: AbortSignal;
  /**
   * Called if a source fails. The fetch resolves with whatever was already
   * resolved (like an abort) rather than rejecting, so partial work is kept.
   */
  onError?: (error: unknown) => void;
};

export type BoundaryResult = {
  tileId: string;
  polygon: GeoJSON.Geometry | null;
};

export type TileCoverageOptions = {
  isFilled: boolean;
  isDisabled: boolean;
  showLabel: boolean;
};

export type FetchProj4Def = (epsgCode: number) => Promise<string | null>;
