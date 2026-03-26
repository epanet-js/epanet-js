import { buildPixelTransformers } from "./pixel-transformer";
import { lngLatToCrs } from "./transform";
import { CrsUnit, GeoTiffTile } from "./types";

const CRS_UNIT_TO_APP_UNIT: Record<CrsUnit, "m" | "ft"> = {
  deg: "m", // geographic CRS — elevation values default to meters
  m: "m",
  ft: "ft",
  "us-ft": "ft", // close enough — 0.01% difference
};

/**
 * Reads a single pixel elevation from a GeoTIFFImage on demand.
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

  const [x, y] = pixelTransformer.toPixel(crsX, crsY);

  if (x < 0 || x >= tile.width || y < 0 || y >= tile.height) {
    return null;
  }

  const rasters = await tile.image.readRasters({
    window: [x, y, x + 1, y + 1],
  });
  const value = (rasters[0] as Float32Array | Float64Array)[0];

  if (
    value === undefined ||
    value === null ||
    isNaN(value) ||
    value === tile.noDataValue
  ) {
    return null;
  }

  // Apply GDAL scale/offset: unscaled = raw * scale + offset
  let unscaled = value;
  if (tile.gdalScale != null || tile.gdalOffset != null) {
    unscaled = value * (tile.gdalScale ?? 1) + (tile.gdalOffset ?? 0);
  }
  // Apply ModelPixelScale Z factor
  const scaled = tile.scaleZ ? unscaled * tile.scaleZ : unscaled;
  const sourceUnit = CRS_UNIT_TO_APP_UNIT[tile.verticalUnit];
  return {
    value: scaled,
    unit: sourceUnit,
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
