import { fromBlob, GeoTIFFImage } from "geotiff";
import { extractElevationTransform } from "./extract-elevation-transform";
import {
  extractProjection,
  extractProjectionUnits,
} from "./extract-projection";
import { crsToLngLat } from "./transform";
import {
  CrsTransform,
  GeoTiffTile,
  PixelTransform,
  TileCoverage,
} from "./types";
import {
  buildPixelTransformers,
  extractPixelTransform,
} from "./pixel-transformer";

export class GeoTiffError extends Error {
  public readonly fileName: string;
  public readonly error: Error;

  constructor(fileName: string, error: Error) {
    super(`GeoTIFF Error ${fileName}: ${error.message}`);
    this.name = "GeoTIFF Error";
    this.fileName = fileName;
    this.error = error;
  }
}

type FetchProj4Def = (epsgCode: number) => Promise<string | null>;

export async function parseGeoTIFF(
  file: File,
  fetchProj4Def: FetchProj4Def,
): Promise<Omit<GeoTiffTile, "id">> {
  try {
    const tiff = await fromBlob(file);
    const image = await tiff.getImage();

    const geoKeys = image.getGeoKeys() as Record<string, number> | null;
    const pixelTransform = extractPixelTransform(image, geoKeys);
    const crsTransform = await extractCrsTransform(geoKeys, fetchProj4Def);
    const elevationTransform = await extractElevationTransform(
      image,
      geoKeys,
      crsTransform.crsUnit,
    );
    const coverage = calculateSimpleCoverage(
      image,
      pixelTransform,
      crsTransform,
    );

    return {
      file,
      image,
      ...crsTransform,
      ...pixelTransform,
      ...elevationTransform,
      ...coverage,
    };
  } catch (error) {
    throw new GeoTiffError(file.name, error as Error);
  }
}

async function extractCrsTransform(
  geoKeys: Record<string, number> | null,
  fetchProj4Def: FetchProj4Def,
): Promise<CrsTransform> {
  const projection = await extractProjection(geoKeys, fetchProj4Def);
  const proj4Def = projection ? projection : undefined;
  return { proj4Def, crsUnit: extractProjectionUnits(proj4Def) ?? "deg" };
}

function calculateSimpleCoverage(
  image: GeoTIFFImage,
  pixelTransform: PixelTransform,
  crsTransform: CrsTransform,
): TileCoverage {
  // Compute bbox from the adjusted transform (accounts for PixelIsPoint)
  const width = image.getWidth();
  const height = image.getHeight();
  const transformer = buildPixelTransformers(pixelTransform);
  const topLeft = transformer.fromPixel(0, 0);
  const bottomRight = transformer.fromPixel(width, height);
  const crsBbox: [number, number, number, number] = [
    Math.min(topLeft[0], bottomRight[0]),
    Math.min(topLeft[1], bottomRight[1]),
    Math.max(topLeft[0], bottomRight[0]),
    Math.max(topLeft[1], bottomRight[1]),
  ];

  let bbox: [number, number, number, number];
  if (crsTransform.proj4Def) {
    bbox = reprojectBbox(crsBbox, crsTransform.proj4Def);
  } else {
    // WGS84 or equivalent — no reprojection needed
    bbox = crsBbox;
  }

  return { width, height, bbox };
}

function reprojectBbox(
  crsBbox: [number, number, number, number],
  proj4Def: string,
): [number, number, number, number] {
  const [west, south, east, north] = crsBbox;
  const corners: [number, number][] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
  ];
  const reprojected = corners.map((c) => crsToLngLat(c, proj4Def));
  const lngs = reprojected.map((c) => c[0]);
  const lats = reprojected.map((c) => c[1]);
  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];
}
