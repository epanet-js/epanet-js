// eslint-disable-next-line no-restricted-imports
import proj4 from "proj4";
import { fromBlob, GeoTIFFImage } from "geotiff";
import { convertTo, type Unit } from "src/quantity";
import type {
  GeoTiffTile,
  GeoTiffElevationSource,
} from "./elevation-source-types";

export type ExtractedTileMetadata = Omit<GeoTiffTile, "id">;

export type GetProj4Def = (epsgCode: number) => Promise<string | null>;

export type UnsupportedProjectionInfo = {
  isProjected: boolean;
  isUserDefined?: boolean;
  epsgCode?: number;
};

export class UnsupportedProjectionError extends Error {
  public readonly fileName: string;
  public readonly projection: UnsupportedProjectionInfo;

  constructor(fileName: string, projection: UnsupportedProjectionInfo) {
    const detail = projection.epsgCode
      ? `EPSG:${projection.epsgCode}`
      : "user-defined projection";
    super(`Unsupported projection in ${fileName}: ${detail}`);
    this.name = "UnsupportedProjectionError";
    this.fileName = fileName;
    this.projection = projection;
  }
}

const WGS84_GEOGRAPHIC_CODES = new Set([4326, 4269]);
const GT_MODEL_TYPE_PROJECTED = 1;
const GT_MODEL_TYPE_GEOGRAPHIC = 2;
const RASTER_PIXEL_IS_POINT = 2;
const USER_DEFINED_CODE = 32767;

/**
 * Extracts metadata from a GeoTIFF file and returns a GeoTIFFImage handle.
 * If getProj4Def is provided and the file is in a projected CRS,
 * the bbox is reprojected to WGS84 and the proj4Def is stored on the tile.
 */
export async function extractGeoTiffMetadata(
  file: File,
  getProj4Def?: GetProj4Def,
): Promise<ExtractedTileMetadata> {
  const tiff = await fromBlob(file);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const crsInfo = detectCrs(image);
  const rawResolution = image.getResolution();
  const resolution: [number, number] = [
    Math.abs(rawResolution[0]),
    Math.abs(rawResolution[1]),
  ];
  const scaleZ =
    rawResolution[2] && rawResolution[2] !== 0 ? rawResolution[2] : 1;
  const { pixelToCrs, crsToPixel } = buildTransformMatrices(
    image,
    crsInfo.pixelIsPoint,
  );

  let noDataValue: number | null = null;
  try {
    noDataValue = image.getGDALNoData();
  } catch {
    // Some files have deferred nodata — ignore
  }

  // Compute bbox from the adjusted transform (accounts for PixelIsPoint)
  const topLeft = transformCoordinates(0, 0, pixelToCrs);
  const bottomRight = transformCoordinates(width, height, pixelToCrs);
  const crsBbox: [number, number, number, number] = [
    Math.min(topLeft[0], bottomRight[0]),
    Math.min(topLeft[1], bottomRight[1]),
    Math.max(topLeft[0], bottomRight[0]),
    Math.max(topLeft[1], bottomRight[1]),
  ];

  let proj4Def: string | undefined;
  let bbox: [number, number, number, number];

  if (crsInfo.isProjected && !crsInfo.epsgCode) {
    throw new UnsupportedProjectionError(file.name, {
      isProjected: true,
      isUserDefined: true,
    });
  }

  if (crsInfo.epsgCode && getProj4Def) {
    const def = await getProj4Def(crsInfo.epsgCode);
    if (def) {
      proj4Def = def;
      bbox = reprojectBbox(crsBbox, def);
    } else {
      throw new UnsupportedProjectionError(file.name, {
        isProjected: crsInfo.isProjected,
        epsgCode: crsInfo.epsgCode,
      });
    }
  } else {
    bbox = crsBbox;
  }

  const crsUnit =
    crsInfo.linearUnit ?? parseLinearUnitFromProj4(proj4Def) ?? "deg";
  const verticalUnit =
    crsInfo.verticalUnit ?? (crsUnit !== "deg" ? crsUnit : "m");

  return {
    file,
    width,
    height,
    bbox,
    resolution,
    pixelToCrs,
    crsToPixel,
    noDataValue,
    image,
    proj4Def,
    crsUnit,
    verticalUnit,
    scaleZ: scaleZ !== 1 ? scaleZ : undefined,
    pixelIsPoint: crsInfo.pixelIsPoint || undefined,
  };
}

/**
 * Reads a single pixel elevation from a GeoTIFFImage on demand.
 * If the tile has a proj4Def, transforms lng/lat → CRS before pixel lookup.
 */
export async function sampleElevation(
  tile: GeoTiffTile,
  lng: number,
  lat: number,
  targetUnit: Unit = "m",
): Promise<number | null> {
  let crsX = lng;
  let crsY = lat;

  if (tile.proj4Def) {
    [crsX, crsY] = lngLatToCrs([lng, lat], tile.proj4Def);
  }

  const [x, y] = transformCoordinates(crsX, crsY, tile.crsToPixel, true);

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

  const scaled = tile.scaleZ ? value * tile.scaleZ : value;
  const sourceUnit = CRS_UNIT_TO_APP_UNIT[tile.verticalUnit];
  return convertTo({ value: scaled, unit: sourceUnit }, targetUnit);
}

type CrsUnit = "deg" | "m" | "ft" | "us-ft";
type LinearUnit = "m" | "ft" | "us-ft";

const PROJ4_UNITS_MAP: Record<string, CrsUnit> = {
  m: "m",
  ft: "ft",
  "us-ft": "us-ft",
};

function parseLinearUnitFromProj4(proj4Def?: string): CrsUnit | undefined {
  if (!proj4Def) return undefined;
  const match = proj4Def.match(/\+units=(\S+)/);
  if (!match) return undefined;
  return PROJ4_UNITS_MAP[match[1]];
}

// GeoTIFF ProjLinearUnitsGeoKey / VerticalUnitsGeoKey → linear unit
const LINEAR_UNIT_MAP: Record<number, LinearUnit> = {
  9001: "m",
  9002: "ft",
  9003: "us-ft",
};

// VerticalCSTypeGeoKey codes that use non-meter units.
// Only ~14 out of ~279 EPSG vertical CRS use feet; everything else defaults to meters.
const VERTICAL_CRS_NON_METER: Record<number, LinearUnit> = {
  6360: "us-ft", // NAVD88 height (ftUS)
  6358: "ft", // NAVD88 height (ft)
  5715: "ft", // MSL depth (ft)
  6638: "us-ft", // PRVD02 height (ftUS)
  6644: "us-ft", // GUVD04 height (ftUS)
  6640: "us-ft", // NMVD03 height (ftUS)
  6642: "us-ft", // ASVD02 height (ftUS)
  6130: "us-ft", // GCVD54 height (ftUS)
};

type CrsInfo = {
  isProjected: boolean;
  epsgCode: number | null;
  linearUnit: LinearUnit | null;
  verticalUnit: LinearUnit | null;
  pixelIsPoint: boolean;
};

function detectCrs(image: GeoTIFFImage): CrsInfo {
  const defaults: CrsInfo = {
    isProjected: false,
    epsgCode: null,
    linearUnit: null,
    verticalUnit: null,
    pixelIsPoint: false,
  };

  try {
    const geoKeys = image.getGeoKeys();
    if (!geoKeys) return defaults;

    const keys = geoKeys as Record<string, number>;
    const modelType = keys.GTModelTypeGeoKey;
    const projectedCode = keys.ProjectedCSTypeGeoKey;
    const geographicCode = keys.GeographicTypeGeoKey;
    const linearUnits = keys.ProjLinearUnitsGeoKey;
    const verticalUnits = keys.VerticalUnitsGeoKey;
    const verticalCsType = keys.VerticalCSTypeGeoKey;
    const rasterType = keys.GTRasterTypeGeoKey;

    const linearUnit = linearUnits
      ? (LINEAR_UNIT_MAP[linearUnits] ?? null)
      : null;
    // Priority: VerticalUnitsGeoKey → VerticalCSType lookup → null
    const verticalUnit: LinearUnit | null = verticalUnits
      ? (LINEAR_UNIT_MAP[verticalUnits] ?? null)
      : verticalCsType
        ? (VERTICAL_CRS_NON_METER[verticalCsType] ?? "m")
        : null;
    const pixelIsPoint = rasterType === RASTER_PIXEL_IS_POINT;

    // GTModelTypeGeoKey = 1 means projected CRS
    if (modelType === GT_MODEL_TYPE_PROJECTED) {
      const epsgCode =
        projectedCode && projectedCode !== USER_DEFINED_CODE
          ? projectedCode
          : null;
      return {
        isProjected: true,
        epsgCode,
        linearUnit,
        verticalUnit,
        pixelIsPoint,
      };
    }

    // GTModelTypeGeoKey = 2 means geographic CRS
    if (modelType === GT_MODEL_TYPE_GEOGRAPHIC) {
      if (geographicCode && !WGS84_GEOGRAPHIC_CODES.has(geographicCode)) {
        return {
          isProjected: false,
          epsgCode: geographicCode,
          linearUnit: null,
          verticalUnit,
          pixelIsPoint,
        };
      }
      return { ...defaults, verticalUnit, pixelIsPoint };
    }

    // No model type
    return { ...defaults, verticalUnit, pixelIsPoint };
  } catch {
    return defaults;
  }
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

export function crsToLngLat(
  coord: [number, number],
  proj4Def: string,
): [number, number] {
  return proj4(proj4Def, "EPSG:4326", coord) as [number, number];
}

export function lngLatToCrs(
  coord: [number, number],
  proj4Def: string,
): [number, number] {
  return proj4("EPSG:4326", proj4Def, coord) as [number, number];
}

function buildTransformMatrices(
  image: GeoTIFFImage,
  pixelIsPoint: boolean,
): {
  pixelToCrs: number[];
  crsToPixel: number[];
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mt = (image.fileDirectory as any).ModelTransformation as
    | number[]
    | undefined;

  if (mt) {
    const a = mt[0],
      b = mt[1];
    const e = mt[4],
      f = mt[5];

    // PixelIsPoint: origin refers to center of pixel (0,0), shift by -0.5 pixel
    const d = pixelIsPoint ? mt[3] - 0.5 * a - 0.5 * b : mt[3];
    const h = pixelIsPoint ? mt[7] - 0.5 * e - 0.5 * f : mt[7];

    const det = a * f - b * e;
    if (Math.abs(det) < 1e-15) {
      throw new Error("Degenerate ModelTransformation matrix.");
    }
    return {
      pixelToCrs: [d, a, b, h, e, f],
      crsToPixel: [
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
  const [rx, ry] = resolution;
  if (!rx || !ry) {
    throw new Error("Cannot determine pixel scale. Is this a valid GeoTIFF?");
  }

  // PixelIsPoint: origin refers to center of pixel (0,0), shift by -0.5 pixel
  let [gx, gy] = origin;
  if (pixelIsPoint) {
    gx = gx - 0.5 * rx;
    gy = gy - 0.5 * ry;
  }

  return {
    pixelToCrs: [gx, rx, 0, gy, 0, ry],
    crsToPixel: [-gx / rx, 1 / rx, 0, -gy / ry, 0, 1 / ry],
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

function bboxToPolygon(
  bbox: [number, number, number, number],
): GeoJSON.Polygon {
  const [west, south, east, north] = bbox;
  return {
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

export function buildCoverageFeature(
  tile: GeoTiffTile,
  {
    isFilled,
    isDisabled,
    showLabel,
  }: { isFilled: boolean; isDisabled: boolean; showLabel: boolean },
): GeoJSON.Feature {
  const geometry: GeoJSON.Geometry =
    tile.coveragePolygon ?? bboxToPolygon(tile.bbox);
  return {
    type: "Feature",
    properties: {
      id: tile.id,
      isFilled,
      isDisabled,
      ...(showLabel && { label: tile.file.name }),
    },
    geometry,
  };
}

const CRS_UNIT_TO_APP_UNIT: Record<CrsUnit, Unit> = {
  deg: "m", // geographic CRS — elevation values default to meters
  m: "m",
  ft: "ft",
  "us-ft": "ft", // close enough — 0.01% difference
};

export function getGeoTiffGridResolution(
  source: GeoTiffElevationSource,
  targetUnit: Unit = "m",
): number {
  if (source.tiles.length === 0) return 0;
  const tile = source.tiles[0];

  const scale = tile.resolution[0];

  // Projected CRS: resolution is in CRS linear units (meters, feet, etc.)
  if (tile.crsUnit !== "deg") {
    const sourceUnit = CRS_UNIT_TO_APP_UNIT[tile.crsUnit];
    return convertTo({ value: scale, unit: sourceUnit }, targetUnit);
  }

  // Geographic CRS: resolution is in degrees, approximate conversion
  const centerLat = (tile.bbox[1] + tile.bbox[3]) / 2;
  const scaleInMeters = scale * 111_320 * Math.cos((centerLat * Math.PI) / 180);
  return convertTo({ value: scaleInMeters, unit: "m" }, targetUnit);
}
