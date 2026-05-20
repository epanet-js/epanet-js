import { buildPixelTransformers } from "./pixel-transformer";
import { CRS_UNIT_TO_APP_UNIT } from "./spec";
import { lngLatToCrs } from "./transform";
import { CrsUnit, GeoTiffTile } from "./types";

export type GeoTiffElevation = { value: number; unit: "m" | "ft" };

/**
 * Minimum pixel resolution to apply bilinear interpolation, per CRS unit.
 * Grids finer than this use nearest-neighbor (interpolation adds no value).
 * All values approximate ~2m.
 */
const INTERPOLATION_THRESHOLD: Record<CrsUnit, number> = {
  deg: 0.00002, // ~2m at the equator
  m: 2,
  ft: 5,
  "us-ft": 5,
};

function shouldInterpolate(tile: GeoTiffTile): boolean {
  const threshold = INTERPOLATION_THRESHOLD[tile.crsUnit];
  return tile.resolution[0] >= threshold || tile.resolution[1] >= threshold;
}

/**
 * Side length (in raster pixels) of the spatial bucket used to group nearby
 * points into a single `readRasters` call. Sized to be a small multiple of the
 * typical internal-tile block size (~128–256 px) so each per-bucket read only
 * touches a handful of internal blocks, even when the larger union of all the
 * tile's points would cover the whole raster.
 */
const READ_BUCKET_SIZE = 256;

/** Subpixel position resolved by bilinear interpolation over a 2×2 neighborhood. */
type BilinearPos = {
  mode: "bilinear";
  window: readonly [number, number, number, number];
  fractionX: number;
  fractionY: number;
};

/** Exact integer pixel position resolved by nearest-neighbor lookup. */
type NearestPos = {
  mode: "nearest";
  x: number;
  y: number;
};

type PointPos = BilinearPos | NearestPos;

/**
 * A spatial bucket: all in-bounds points whose read windows fall inside one
 * `READ_BUCKET_SIZE × READ_BUCKET_SIZE` raster cell, plus the union pixel
 * window that covers them. One `readRasters` call per bucket.
 */
type ReadBucket = {
  indices: number[];
  positions: PointPos[];
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * Reads elevation from a GeoTIFFImage, using bilinear interpolation for
 * coarse grids and nearest-neighbor for fine grids (< ~2m).
 * If the tile has a proj4Def, transforms lng/lat → CRS before pixel lookup.
 */
export async function fetchGeoTiffTileElevation(
  tile: GeoTiffTile,
  lng: number,
  lat: number,
): Promise<GeoTiffElevation | null> {
  const [result] = await fetchGeoTiffTileElevationsForPoints(tile, [
    { lng, lat },
  ]);
  return result;
}

/**
 * Bulk variant of fetchGeoTiffTileElevation: builds the pixel transformer once,
 * reprojects all points, then buckets them by `READ_BUCKET_SIZE` pixel cells
 * so each `readRasters` call only touches the internal raster blocks the
 * points actually live in. Critical for diagonal paths across large rasters:
 * a single union-window read would decompress the whole raster.
 *
 * Out-of-bounds points and nodata pixels yield `null` at their index.
 */
export async function fetchGeoTiffTileElevationsForPoints(
  tile: GeoTiffTile,
  points: { lng: number; lat: number }[],
): Promise<(GeoTiffElevation | null)[]> {
  const results: (GeoTiffElevation | null)[] = new Array(points.length).fill(
    null,
  );
  if (points.length === 0) return results;

  const buckets = bucketPointsByCell(tile, points);
  const unit = CRS_UNIT_TO_APP_UNIT[tile.verticalUnit];

  for (const bucket of buckets.values()) {
    const band = await readRawElevationBand(tile, [
      bucket.left,
      bucket.top,
      bucket.right,
      bucket.bottom,
    ]);

    for (let k = 0; k < bucket.indices.length; k++) {
      const raw = sampleFromBand(band, bucket, bucket.positions[k], tile);
      if (raw === null) continue;
      results[bucket.indices[k]] = {
        value: applyElevationTransform(raw, tile),
        unit,
      };
    }
  }

  return results;
}

export function isPointInBbox(
  lng: number,
  lat: number,
  bbox: [number, number, number, number],
): boolean {
  const [west, south, east, north] = bbox;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

function isOutOfBounds(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x < 0 || x >= width || y < 0 || y >= height;
}

/**
 * Finds the 2x2 pixel neighborhood around a point and returns the read window
 * coordinates plus the fractional position within that window.
 *
 * Pixel values live at pixel centers (integer + 0.5 in pixel coords), so we
 * shift by -0.5 to align the interpolation grid with the sample points.
 */
function getInterpolationWindow(
  pixelX: number,
  pixelY: number,
  width: number,
  height: number,
) {
  const centeredX = pixelX - 0.5;
  const centeredY = pixelY - 0.5;

  const windowLeft = Math.max(0, Math.min(Math.floor(centeredX), width - 2));
  const windowTop = Math.max(0, Math.min(Math.floor(centeredY), height - 2));

  const fractionX = Math.min(Math.max(centeredX - windowLeft, 0), 1);
  const fractionY = Math.min(Math.max(centeredY - windowTop, 0), 1);

  return {
    window: [windowLeft, windowTop, windowLeft + 2, windowTop + 2] as const,
    fractionX,
    fractionY,
  };
}

/** Reads the first raster band for the given pixel window. */
async function readRawElevationBand(
  tile: GeoTiffTile,
  window: readonly [number, number, number, number],
): Promise<Float32Array | Float64Array> {
  const rasters = await tile.image.readRasters({ window: [...window] });
  return rasters[0] as Float32Array | Float64Array;
}

/**
 * Computes the bilinear-interpolated value from 4 neighboring values,
 * weighted by the fractional position within the neighborhood.
 * Nodata pixels are excluded and weights renormalized over valid neighbors.
 */
function bilinearInterpolate(
  neighbors: [number, number, number, number],
  fractionX: number,
  fractionY: number,
  noDataValue: number | null,
): number | null {
  const [topLeft, topRight, bottomLeft, bottomRight] = neighbors;

  const isNoData = (v: number) =>
    v === undefined || v === null || isNaN(v) || v === noDataValue;

  const weightedNeighbors: [number, number][] = [
    [(1 - fractionX) * (1 - fractionY), topLeft],
    [fractionX * (1 - fractionY), topRight],
    [(1 - fractionX) * fractionY, bottomLeft],
    [fractionX * fractionY, bottomRight],
  ];

  const valid = weightedNeighbors.filter(([, v]) => !isNoData(v));
  if (valid.length === 0) return null;

  const totalWeight = valid.reduce((sum, [w]) => sum + w, 0);
  if (totalWeight === 0) return null;
  return valid.reduce((sum, [w, v]) => sum + (w / totalWeight) * v, 0);
}

/** Applies GDAL scale/offset and ModelPixelScale Z factor to a raw value. */
function applyElevationTransform(
  rawElevation: number,
  tile: Pick<GeoTiffTile, "gdalScale" | "gdalOffset" | "scaleZ">,
): number {
  let elevation = rawElevation;
  if (tile.gdalScale != null || tile.gdalOffset != null) {
    elevation = rawElevation * (tile.gdalScale ?? 1) + (tile.gdalOffset ?? 0);
  }
  if (tile.scaleZ) {
    elevation = elevation * tile.scaleZ;
  }
  return elevation;
}

/**
 * Resolves a single (lng, lat) into a `PointPos` describing how to sample it.
 * Reprojects through `tile.proj4Def` if the tile is not WGS84.
 * Returns null when the point falls outside the tile's pixel grid.
 */
function computePointPosition(
  tile: GeoTiffTile,
  lng: number,
  lat: number,
  transformer: ReturnType<typeof buildPixelTransformers>,
  useInterpolation: boolean,
): PointPos | null {
  let crsX = lng;
  let crsY = lat;
  if (tile.proj4Def) {
    [crsX, crsY] = lngLatToCrs([lng, lat], tile.proj4Def);
  }

  if (useInterpolation) {
    const [pixelX, pixelY] = transformer.toSubPixel(crsX, crsY);
    if (isOutOfBounds(pixelX, pixelY, tile.width, tile.height)) return null;
    const { window, fractionX, fractionY } = getInterpolationWindow(
      pixelX,
      pixelY,
      tile.width,
      tile.height,
    );
    return { mode: "bilinear", window, fractionX, fractionY };
  }

  const [x, y] = transformer.toPixel(crsX, crsY);
  if (isOutOfBounds(x, y, tile.width, tile.height)) return null;
  return { mode: "nearest", x, y };
}

/**
 * Groups points by `READ_BUCKET_SIZE`-px cell so each bucket can be served by
 * one small `readRasters` call. Out-of-bounds points are dropped silently —
 * the caller's result array stays `null` at those indices.
 */
function bucketPointsByCell(
  tile: GeoTiffTile,
  points: { lng: number; lat: number }[],
): Map<string, ReadBucket> {
  const transformer = buildPixelTransformers(tile);
  const useInterpolation = shouldInterpolate(tile);
  const buckets = new Map<string, ReadBucket>();

  for (let i = 0; i < points.length; i++) {
    const pos = computePointPosition(
      tile,
      points[i].lng,
      points[i].lat,
      transformer,
      useInterpolation,
    );
    if (pos === null) continue;

    addToBucket(buckets, pos, i);
  }

  return buckets;
}

function addToBucket(
  buckets: Map<string, ReadBucket>,
  pos: PointPos,
  index: number,
): void {
  const pLeft = pos.mode === "bilinear" ? pos.window[0] : pos.x;
  const pTop = pos.mode === "bilinear" ? pos.window[1] : pos.y;
  const pRight = pos.mode === "bilinear" ? pos.window[2] : pos.x + 1;
  const pBottom = pos.mode === "bilinear" ? pos.window[3] : pos.y + 1;

  const cellX = Math.floor(pLeft / READ_BUCKET_SIZE);
  const cellY = Math.floor(pTop / READ_BUCKET_SIZE);
  const key = `${cellX},${cellY}`;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      indices: [],
      positions: [],
      left: pLeft,
      top: pTop,
      right: pRight,
      bottom: pBottom,
    };
    buckets.set(key, bucket);
  } else {
    if (pLeft < bucket.left) bucket.left = pLeft;
    if (pTop < bucket.top) bucket.top = pTop;
    if (pRight > bucket.right) bucket.right = pRight;
    if (pBottom > bucket.bottom) bucket.bottom = pBottom;
  }
  bucket.indices.push(index);
  bucket.positions.push(pos);
}

/** Dispatches to bilinear or nearest-neighbor sampling for one point. */
function sampleFromBand(
  band: Float32Array | Float64Array,
  bucket: ReadBucket,
  pos: PointPos,
  tile: GeoTiffTile,
): number | null {
  if (pos.mode === "bilinear") {
    return sampleBilinearFromBand(band, bucket, pos, tile.noDataValue);
  }
  return sampleNearestFromBand(band, bucket, pos, tile.noDataValue);
}

/** Reads the point's 2×2 neighborhood out of the bucket's band and interpolates. */
function sampleBilinearFromBand(
  band: Float32Array | Float64Array,
  bucket: ReadBucket,
  pos: BilinearPos,
  noDataValue: number | null,
): number | null {
  const windowWidth = bucket.right - bucket.left;
  const [wx, wy] = pos.window;
  const localX = wx - bucket.left;
  const localY = wy - bucket.top;
  const rowTop = localY * windowWidth;
  const rowBottom = (localY + 1) * windowWidth;
  const neighbors: [number, number, number, number] = [
    band[rowTop + localX],
    band[rowTop + localX + 1],
    band[rowBottom + localX],
    band[rowBottom + localX + 1],
  ];
  return bilinearInterpolate(
    neighbors,
    pos.fractionX,
    pos.fractionY,
    noDataValue,
  );
}

/** Reads the point's exact pixel out of the bucket's band, honoring nodata. */
function sampleNearestFromBand(
  band: Float32Array | Float64Array,
  bucket: ReadBucket,
  pos: NearestPos,
  noDataValue: number | null,
): number | null {
  const windowWidth = bucket.right - bucket.left;
  const localX = pos.x - bucket.left;
  const localY = pos.y - bucket.top;
  const raw = band[localY * windowWidth + localX];
  if (raw === undefined || raw === null || isNaN(raw) || raw === noDataValue) {
    return null;
  }
  return raw;
}
