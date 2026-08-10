export type LngLat = { lat: number; lng: number };

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

export type GeoTiffTile = {
  id: string;
  file: File;
  /** Bounding box in WGS84 [west, south, east, north]. */
  bbox: [number, number, number, number];
  /** Computed data boundary — replaces bbox for display when present. */
  coveragePolygon?: GeoJSON.Geometry;
  /** Vertical/elevation unit. Always linear — defaults to "m". */
  verticalUnit: LinearUnit;
  /**
   * Raster metadata owned by whichever engine parsed this tile: the pixel and
   * CRS transforms, nodata, band scaling, and a handle to the image. Opaque
   * here so this package needs no raster library, and so how a DTM is read
   * stays with the engine that reads it.
   */
  raster: unknown;
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
