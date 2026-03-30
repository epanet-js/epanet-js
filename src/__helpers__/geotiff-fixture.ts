/**
 * GeoTIFF fixture generator — creates minimal .tif files with precise geokeys.
 *
 * The `geotiff` library's `writeArrayBuffer` auto-builds the GeoKeyDirectory
 * from individual `*GeoKey` properties, but its `fieldTagTypes` map only
 * covers a small subset of keys. Most projection parameters (ProjCoordTrans,
 * lat/lon of origin, false easting, ellipsoid, etc.) are silently dropped.
 *
 * This module works around that by building the raw `GeoKeyDirectory` and
 * `GeoDoubleParams` arrays, which `writeArrayBuffer` passes through as-is
 * when provided explicitly.
 *
 * Usage:
 *   import { buildFixture } from "src/__helpers__/geotiff-fixture";
 *   const file = buildFixture({ geoKeys: {...}, ... });
 *   const metadata = await parseGeoTIFF(file, fetchProj4Def);
 */
import { writeArrayBuffer } from "geotiff";

/** SHORT-valued GeoKeys (value stored inline in the directory) */
const SHORT_KEYS = new Set([
  1024, 1025, 2048, 2050, 2051, 2052, 2054, 2056, 2060, 3072, 3074, 3075, 3076,
  4096, 4099,
]);

/**
 * Builds the raw GeoKeyDirectory (uint16[]) and GeoDoubleParams (float64[])
 * from a flat object of GeoKey ID → value.
 *
 * SHORT-valued keys are stored inline in the directory.
 * All other numeric keys are stored as DOUBLEs in GeoDoubleParams,
 * referenced by index from the directory.
 */
function buildGeoKeyArrays(geoKeys: Record<number, number>): {
  GeoKeyDirectory: number[];
  GeoDoubleParams: number[];
} {
  const dir = [1, 1, 0, 0]; // [version, revision, minor, numKeys]
  const doubles: number[] = [];
  let numKeys = 0;

  const sortedIds = Object.keys(geoKeys)
    .map(Number)
    .sort((a, b) => a - b);

  for (const keyId of sortedIds) {
    const value = geoKeys[keyId];
    if (SHORT_KEYS.has(keyId)) {
      dir.push(keyId, 0, 1, value);
    } else {
      dir.push(keyId, 34736, 1, doubles.length);
      doubles.push(value);
    }
    numKeys++;
  }
  dir[3] = numKeys;

  return { GeoKeyDirectory: dir, GeoDoubleParams: doubles };
}

const RASTER_2x2 = [
  [
    [0, 0],
    [0, 0],
  ],
];

export type FixtureOptions = {
  raster?: number[][][];
  tiepoint: number[];
  pixelScale: number[];
  geoKeys: Record<number, number>;
  fileName?: string;
};

/**
 * Builds a minimal GeoTIFF `File` with the given spatial metadata.
 */
export function buildFixture(opts: FixtureOptions): File {
  const raster = opts.raster ?? RASTER_2x2;
  const { GeoKeyDirectory, GeoDoubleParams } = buildGeoKeyArrays(opts.geoKeys);

  // writeArrayBuffer overwrites ModelTiepoint with a whole-globe default
  // when it doesn't find GeographicTypeGeoKey or ProjectedCSTypeGeoKey as
  // top-level properties (even if they're inside a raw GeoKeyDirectory).
  // Pass a dummy to prevent that — it gets cleaned up internally.
  const projHint =
    opts.geoKeys[3072] != null
      ? { ProjectedCSTypeGeoKey: opts.geoKeys[3072] }
      : { GeographicTypeGeoKey: opts.geoKeys[2048] ?? 4326 };

  const buf = writeArrayBuffer(raster, {
    ModelTiepoint: opts.tiepoint,
    ModelPixelScale: opts.pixelScale,
    GeoKeyDirectory,
    ...(GeoDoubleParams.length > 0 ? { GeoDoubleParams } : {}),
    ...projHint,
  });

  const bytes = new Uint8Array(buf);
  return new File([bytes], opts.fileName ?? "fixture.tif", {
    type: "image/tiff",
  });
}

/** Same as buildFixture but returns raw bytes (useful for writing to disk). */
export function buildFixtureBytes(opts: FixtureOptions): Uint8Array {
  const raster = opts.raster ?? RASTER_2x2;
  const { GeoKeyDirectory, GeoDoubleParams } = buildGeoKeyArrays(opts.geoKeys);

  const projHint =
    opts.geoKeys[3072] != null
      ? { ProjectedCSTypeGeoKey: opts.geoKeys[3072] }
      : { GeographicTypeGeoKey: opts.geoKeys[2048] ?? 4326 };

  const buf = writeArrayBuffer(raster, {
    ModelTiepoint: opts.tiepoint,
    ModelPixelScale: opts.pixelScale,
    GeoKeyDirectory,
    ...(GeoDoubleParams.length > 0 ? { GeoDoubleParams } : {}),
    ...projHint,
  });

  return new Uint8Array(buf);
}
