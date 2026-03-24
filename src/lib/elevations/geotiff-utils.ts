import { fromBlob, GeoTIFFImage } from "geotiff";
import type {
  GeoTiffTile,
  GeoTiffElevationSource,
} from "./elevation-source-types";

export type ExtractedTileMetadata = Omit<GeoTiffTile, "id">;

/**
 * Extracts metadata from a GeoTIFF file and returns a GeoTIFFImage handle.
 * The handle is lightweight — it holds a reference to the File blob
 * but does not load raster data into memory.
 */
export async function extractGeoTiffMetadata(
  file: File,
): Promise<ExtractedTileMetadata> {
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const { pixelToGps, gpsToPixel } = buildTransformMatrices(image);

  let noDataValue: number | null = null;
  try {
    noDataValue = image.getGDALNoData();
  } catch {
    // Some files have deferred nodata — ignore
  }

  const bbox = image.getBoundingBox() as [number, number, number, number];

  return {
    file,
    width,
    height,
    bbox,
    pixelToGps,
    gpsToPixel,
    noDataValue,
    image,
  };
}

/**
 * Reads a single pixel elevation from a GeoTIFFImage on demand.
 * Only the requested pixel is read from the underlying File blob.
 */
export async function sampleElevation(
  tile: GeoTiffTile,
  lng: number,
  lat: number,
): Promise<number | null> {
  const [x, y] = transformCoordinates(lng, lat, tile.gpsToPixel, true);

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

  return value;
}

function buildTransformMatrices(image: GeoTIFFImage): {
  pixelToGps: number[];
  gpsToPixel: number[];
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mt = (image.fileDirectory as any).ModelTransformation as
    | number[]
    | undefined;

  if (mt) {
    const a = mt[0],
      b = mt[1],
      d = mt[3];
    const e = mt[4],
      f = mt[5],
      h = mt[7];
    const det = a * f - b * e;
    if (Math.abs(det) < 1e-15) {
      throw new Error("Degenerate ModelTransformation matrix.");
    }
    return {
      pixelToGps: [d, a, b, h, e, f],
      gpsToPixel: [
        (-f * d + b * h) / det,
        f / det,
        -b / det,
        (e * d - a * h) / det,
        -e / det,
        a / det,
      ],
    };
  }

  const origin = image.getOrigin();
  const resolution = image.getResolution();
  const [gx, gy] = origin;
  const [rx, ry] = resolution;
  if (!rx || !ry) {
    throw new Error("Cannot determine pixel scale. Is this a valid GeoTIFF?");
  }

  return {
    pixelToGps: [gx, rx, 0, gy, 0, ry],
    gpsToPixel: [-gx / rx, 1 / rx, 0, -gy / ry, 0, 1 / ry],
  };
}

export function transformCoordinates(
  a: number,
  b: number,
  matrix: number[],
  roundToInt = false,
): [number, number] {
  const round = (v: number) => (roundToInt ? Math.floor(v) : v);
  return [
    round(matrix[0] + matrix[1] * a + matrix[2] * b),
    round(matrix[3] + matrix[4] * a + matrix[5] * b),
  ];
}

export function isPointInBbox(
  lng: number,
  lat: number,
  bbox: [number, number, number, number],
): boolean {
  const [west, south, east, north] = bbox;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

export function buildCoverageFeature(
  tile: GeoTiffTile,
  {
    isFilled,
    isDisabled,
    showLabel,
  }: { isFilled: boolean; isDisabled: boolean; showLabel: boolean },
): GeoJSON.Feature {
  const [west, south, east, north] = tile.bbox;
  return {
    type: "Feature",
    properties: {
      id: tile.id,
      isFilled,
      isDisabled,
      ...(showLabel && { label: tile.file.name }),
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

export function getGeoTiffGridResolutionM(
  source: GeoTiffElevationSource,
): number {
  if (source.tiles.length === 0) return 0;
  const tile = source.tiles[0];
  const centerLat = (tile.bbox[1] + tile.bbox[3]) / 2;
  const degPerPixel = Math.abs(tile.pixelToGps[1]);
  return degPerPixel * 111_320 * Math.cos((centerLat * Math.PI) / 180);
}
