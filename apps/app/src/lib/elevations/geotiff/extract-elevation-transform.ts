import { GeoTIFFImage } from "geotiff";
import { LINEAR_UNIT_MAP, VERTICAL_CRS_NON_METER } from "./spec";
import { CrsUnit, ElevationTransform, LinearUnit } from "./types";

export async function extractElevationTransform(
  image: GeoTIFFImage,
  geoKeys: Record<string, number> | null,
  crsUnit: CrsUnit,
): Promise<ElevationTransform> {
  const rawResolution = image.getResolution();
  const scaleZ =
    rawResolution[2] && rawResolution[2] !== 0 ? rawResolution[2] : 1;

  let noDataValue: number | null = null;
  try {
    noDataValue = image.getGDALNoData();
  } catch {
    // Some files have deferred nodata — ignore
  }

  let verticalUnit: LinearUnit = "m";
  if (geoKeys !== null) {
    if (geoKeys.VerticalCSTypeGeoKey) {
      verticalUnit =
        VERTICAL_CRS_NON_METER[geoKeys.VerticalCSTypeGeoKey] ?? "m";
    } else if (geoKeys.VerticalUnitsGeoKey) {
      verticalUnit = LINEAR_UNIT_MAP[geoKeys.VerticalUnitsGeoKey] ?? "m";
    } else if (crsUnit !== "deg") {
      verticalUnit = crsUnit;
    }
  }

  let gdalMetadata: Record<string, unknown> | null = null;
  try {
    gdalMetadata = await image.getGDALMetadata(0);
  } catch {
    // GDAL_METADATA tag may not exist — ignore
  }
  let gdalScale: number | undefined;
  let gdalOffset: number | undefined;
  if (gdalMetadata) {
    const s =
      gdalMetadata.SCALE != null ? Number(gdalMetadata.SCALE) : undefined;
    const o =
      gdalMetadata.OFFSET != null ? Number(gdalMetadata.OFFSET) : undefined;
    if (s != null && !isNaN(s) && s !== 1) gdalScale = s;
    if (o != null && !isNaN(o) && o !== 0) gdalOffset = o;
  }

  return {
    noDataValue,
    verticalUnit,
    gdalScale,
    gdalOffset,
    scaleZ: scaleZ !== 1 ? scaleZ : undefined,
  };
}
