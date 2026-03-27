import { buildPixelTransformers } from "./pixel-transformer";
import { CRS_UNIT_TO_APP_UNIT } from "./spec";
import { lngLatToCrs } from "./transform";
import { CrsUnit, GeoTiffTile } from "./types";

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
 * Reads elevation from a GeoTIFFImage, using bilinear interpolation for
 * coarse grids and nearest-neighbor for fine grids (< ~2m).
 * If the tile has a proj4Def, transforms lng/lat → CRS before pixel lookup.
 */
export async function fetchGeoTiffTileElevation(
  tile: GeoTiffTile,
  lng: number,
  lat: number,
): Promise<{ value: number; unit: "m" | "ft" } | null> {
  let crsX = lng;
  let crsY = lat;

  if (tile.proj4Def) {
    [crsX, crsY] = lngLatToCrs([lng, lat], tile.proj4Def);
  }

  const pixelTransformer = buildPixelTransformers(tile);

  if (!shouldInterpolate(tile)) {
    const [x, y] = pixelTransformer.toPixel(crsX, crsY);
    if (isOutOfBounds(x, y, tile.width, tile.height)) return null;

    const rawElevations = await readRawElevationsInWindow(tile, [
      x,
      y,
      x + 1,
      y + 1,
    ]);
    const raw = rawElevations[0];

    if (
      raw === undefined ||
      raw === null ||
      isNaN(raw) ||
      raw === tile.noDataValue
    ) {
      return null;
    }
    return {
      value: applyElevationTransform(raw, tile),
      unit: CRS_UNIT_TO_APP_UNIT[tile.verticalUnit],
    };
  }

  const [pixelX, pixelY] = pixelTransformer.toSubPixel(crsX, crsY);
  if (isOutOfBounds(pixelX, pixelY, tile.width, tile.height)) return null;

  const { window, fractionX, fractionY } = getInterpolationWindow(
    pixelX,
    pixelY,
    tile.width,
    tile.height,
  );

  const rawElevations = await readRawElevationsInWindow(tile, window);

  const raw = bilinearInterpolate(
    rawElevations,
    fractionX,
    fractionY,
    tile.noDataValue,
  );
  if (raw === null) return null;

  return {
    value: applyElevationTransform(raw, tile),
    unit: CRS_UNIT_TO_APP_UNIT[tile.verticalUnit],
  };
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

/** Reads the 2x2 pixel neighborhood from the raster at the given window. */
async function readRawElevationsInWindow(
  tile: GeoTiffTile,
  window: readonly [number, number, number, number],
): Promise<[number, number, number, number]> {
  const rasters = await tile.image.readRasters({ window: [...window] });
  const band = rasters[0] as Float32Array | Float64Array;
  return [band[0], band[1], band[2], band[3]];
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
