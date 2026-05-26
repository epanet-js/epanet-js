import { describe, it, expect } from "vitest";

import { GeoTiffError, parseGeoTIFF } from "./parse-geotiff";
import { ProjectionError } from "./extract-projection";
import { TransformError } from "./pixel-transformer";
import { buildFixture } from "src/__helpers__/geotiff-fixture";
import {
  GeoKey,
  ModelType,
  RasterType,
  Ellipsoid,
  CoordTrans,
  LinearUnitCode,
  VerticalCRS,
  USER_DEFINED_CODE,
} from "./spec";

const WGS84_KEYS = {
  [GeoKey.GTModelType]: ModelType.Geographic,
  [GeoKey.GTRasterType]: RasterType.PixelIsArea,
  [GeoKey.GeographicType]: 4326,
};

/** Builds a WGS84 2×2 fixture with optional geokey overrides. */
function wgs84Fixture(
  geoKeys: Record<number, number> = {},
  pixelScale = [0.25, 0.25, 0],
) {
  return buildFixture({
    tiepoint: [0, 0, 0, -4, 56, 0],
    pixelScale,
    geoKeys: { ...WGS84_KEYS, ...geoKeys },
  });
}

// prettier-ignore
const ELEVATION_RASTER = new Float32Array([
  100, 110, 120,   130,
  105, 115, 125,   135,
  110, 120, -9999, 140,
  115, 125, 135,   145,
]);

/** 4×4 float32 grid, origin (-4, 56), pixel size 0.25°, nodata -9999. */
function elevationFixture() {
  return buildFixture({
    flatRaster: { data: ELEVATION_RASTER, width: 4, height: 4 },
    noDataValue: -9999,
    tiepoint: [0, 0, 0, -4, 56, 0],
    pixelScale: [0.25, 0.25, 0],
    geoKeys: WGS84_KEYS,
  });
}

const fetchProj4DefFake = vi.fn().mockResolvedValue("");
const fetchProj4DefNull = vi.fn().mockResolvedValue(null);

describe("parseGeoTIFF", () => {
  it("extracts correct metadata from a WGS84 GeoTIFF", async () => {
    const file = elevationFixture();
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.width).toBe(4);
    expect(metadata.height).toBe(4);
    expect(metadata.bbox).toEqual([-4, 55, -3, 56]);
    expect(metadata.noDataValue).toBe(-9999);
    expect(metadata.file).toBe(file);
    expect(metadata.image).toBeDefined();
  });

  it("sets crsUnit to deg for WGS84 files", async () => {
    const file = elevationFixture();
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.crsUnit).toBe("deg");
  });

  it("defaults verticalUnit to m for WGS84 files", async () => {
    const file = elevationFixture();
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.verticalUnit).toBe("m");
  });

  it("does not set proj4Def for WGS84 files", async () => {
    const file = elevationFixture();
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.proj4Def).toBeUndefined();
  });

  it("extracts resolution from the file", async () => {
    const file = elevationFixture();
    const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

    expect(metadata.resolution).toEqual([0.25, 0.25]);
  });

  describe("custom projection", () => {
    it("builds a Transverse Mercator proj4Def from geokeys", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 400000, 650000, 0],
        pixelScale: [50, 50, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
          [GeoKey.ProjectedCSType]: USER_DEFINED_CODE,
          [GeoKey.ProjCoordTrans]: CoordTrans.TransverseMercator,
          [GeoKey.ProjLinearUnits]: LinearUnitCode.Meter,
          [GeoKey.GeogEllipsoid]: Ellipsoid.Airy,
          [GeoKey.ProjNatOriginLat]: 49.0,
          [GeoKey.ProjNatOriginLong]: -2.0,
          [GeoKey.ProjScaleAtNatOrigin]: 0.9996012717,
          [GeoKey.ProjFalseEasting]: 400000,
          [GeoKey.ProjFalseNorthing]: -100000,
        },
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.proj4Def).toContain("+proj=tmerc");
      expect(metadata.proj4Def).toContain("+lat_0=49");
      expect(metadata.proj4Def).toContain("+lon_0=-2");
      expect(metadata.proj4Def).toContain("+k=0.9996012717");
      expect(metadata.proj4Def).toContain("+x_0=400000");
      expect(metadata.proj4Def).toContain("+y_0=-100000");
      expect(metadata.proj4Def).toContain("+ellps=airy");
      expect(metadata.proj4Def).toContain("+units=m");
    });

    it("sets crsUnit to m for meters projection", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 400000, 650000, 0],
        pixelScale: [50, 50, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.ProjectedCSType]: USER_DEFINED_CODE,
          [GeoKey.ProjCoordTrans]: CoordTrans.TransverseMercator,
          [GeoKey.ProjLinearUnits]: LinearUnitCode.Meter,
          [GeoKey.GeogEllipsoid]: Ellipsoid.Airy,
          [GeoKey.ProjNatOriginLat]: 49.0,
          [GeoKey.ProjNatOriginLong]: -2.0,
          [GeoKey.ProjScaleAtNatOrigin]: 0.9996012717,
          [GeoKey.ProjFalseEasting]: 400000,
          [GeoKey.ProjFalseNorthing]: -100000,
        },
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.crsUnit).toBe("m");
      expect(metadata.verticalUnit).toBe("m");
    });

    it("reprojects the bbox to WGS84", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 400000, 650000, 0],
        pixelScale: [50, 50, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.ProjectedCSType]: USER_DEFINED_CODE,
          [GeoKey.ProjCoordTrans]: CoordTrans.TransverseMercator,
          [GeoKey.ProjLinearUnits]: LinearUnitCode.Meter,
          [GeoKey.GeogEllipsoid]: Ellipsoid.Airy,
          [GeoKey.ProjNatOriginLat]: 49.0,
          [GeoKey.ProjNatOriginLong]: -2.0,
          [GeoKey.ProjScaleAtNatOrigin]: 0.9996012717,
          [GeoKey.ProjFalseEasting]: 400000,
          [GeoKey.ProjFalseNorthing]: -100000,
        },
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      // Origin (400000, 650000) in OSGB-like tmerc — should be in the UK
      const [west, south, east, north] = metadata.bbox;
      expect(west).toBeGreaterThan(-10);
      expect(west).toBeLessThan(5);
      expect(south).toBeGreaterThan(45);
      expect(north).toBeLessThan(65);
      expect(east).toBeGreaterThan(west);
      expect(north).toBeGreaterThan(south);
    });

    it("builds a Lambert Conformal Conic proj4Def in US feet", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 2000000, 500000, 0],
        pixelScale: [100, 100, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.ProjectedCSType]: USER_DEFINED_CODE,
          [GeoKey.ProjCoordTrans]: CoordTrans.LambertConfConic2SP,
          [GeoKey.ProjLinearUnits]: LinearUnitCode.USSurveyFoot,
          [GeoKey.GeogEllipsoid]: Ellipsoid.GRS80,
          [GeoKey.ProjNatOriginLat]: 33.75,
          [GeoKey.ProjNatOriginLong]: -79.0,
          [GeoKey.ProjStdParallel1]: 34.333,
          [GeoKey.ProjStdParallel2]: 36.167,
          [GeoKey.ProjFalseEasting]: 2000000 * 0.3048006096012192,
          [GeoKey.ProjFalseNorthing]: 0,
        },
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.proj4Def).toContain("+proj=lcc");
      expect(metadata.proj4Def).toContain("+lat_1=34.333");
      expect(metadata.proj4Def).toContain("+lat_2=36.167");
      expect(metadata.proj4Def).toContain("+units=us-ft");
      expect(metadata.proj4Def).toContain("+ellps=GRS80");
      expect(metadata.crsUnit).toBe("us-ft");
    });
  });

  describe("known EPSG code", () => {
    it("uses fetchProj4Def for a known projected CRS", async () => {
      const utmDef =
        "+proj=utm +zone=30 +datum=WGS84 +units=m +no_defs +type=crs";
      const fetchProj4Def = vi.fn().mockResolvedValue(utmDef);

      const file = buildFixture({
        tiepoint: [0, 0, 0, 500000, 5500000, 0],
        pixelScale: [10, 10, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
          [GeoKey.ProjectedCSType]: 32630,
          [GeoKey.ProjLinearUnits]: LinearUnitCode.Meter,
        },
      });
      const metadata = await parseGeoTIFF(file, fetchProj4Def);

      expect(fetchProj4Def).toHaveBeenCalledWith(32630);
      expect(metadata.proj4Def).toBe(utmDef);
      expect(metadata.crsUnit).toBe("m");
    });
  });

  describe("vertical units", () => {
    it("reads VerticalUnitsGeoKey (international feet)", async () => {
      const file = wgs84Fixture({
        [GeoKey.VerticalUnits]: LinearUnitCode.Foot,
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.verticalUnit).toBe("ft");
      expect(metadata.crsUnit).toBe("deg");
    });

    it("reads VerticalCSTypeGeoKey for NAVD88 US feet", async () => {
      const file = wgs84Fixture({
        [GeoKey.VerticalCSType]: VerticalCRS.NAVD88_UsFeet,
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.verticalUnit).toBe("us-ft");
    });

    it("falls back to CRS unit for projected files without vertical key", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 2000000, 500000, 0],
        pixelScale: [100, 100, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.ProjectedCSType]: USER_DEFINED_CODE,
          [GeoKey.ProjCoordTrans]: CoordTrans.LambertConfConic2SP,
          [GeoKey.ProjLinearUnits]: LinearUnitCode.USSurveyFoot,
          [GeoKey.GeogEllipsoid]: Ellipsoid.GRS80,
          [GeoKey.ProjNatOriginLat]: 33.75,
          [GeoKey.ProjNatOriginLong]: -79.0,
          [GeoKey.ProjStdParallel1]: 34.333,
          [GeoKey.ProjStdParallel2]: 36.167,
          [GeoKey.ProjFalseEasting]: 2000000 * 0.3048006096012192,
          [GeoKey.ProjFalseNorthing]: 0,
        },
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.verticalUnit).toBe("us-ft");
    });
  });

  describe("elevation scaling", () => {
    it("extracts scaleZ from ModelPixelScale[2]", async () => {
      const file = wgs84Fixture({}, [0.25, 0.25, 0.01]);
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.scaleZ).toBe(0.01);
    });

    it("omits scaleZ when ModelPixelScale[2] is 0", async () => {
      const file = elevationFixture();
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.scaleZ).toBeUndefined();
    });
  });

  describe("pixel interpretation", () => {
    it("adjusts bbox for PixelIsPoint", async () => {
      const file = wgs84Fixture({
        [GeoKey.GTRasterType]: RasterType.PixelIsPoint,
      });
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.pixelIsPoint).toBe(true);
      // Origin (-4, 56), scale (0.25, -0.25), 2×2. Shift by -0.5 pixel:
      //   gx = -4.125, gy = 56.125 → bottom-right = (-3.625, 55.625)
      expect(metadata.bbox[0]).toBeCloseTo(-4.125, 5);
      expect(metadata.bbox[1]).toBeCloseTo(55.625, 5);
      expect(metadata.bbox[2]).toBeCloseTo(-3.625, 5);
      expect(metadata.bbox[3]).toBeCloseTo(56.125, 5);
    });

    it("does not adjust bbox for PixelIsArea (default)", async () => {
      const file = elevationFixture();
      const metadata = await parseGeoTIFF(file, fetchProj4DefFake);

      expect(metadata.pixelIsPoint).toBeFalsy();
      expect(metadata.bbox).toEqual([-4, 55, -3, 56]);
    });
  });

  describe("error paths", () => {
    it("wraps all errors in GeoTiffError", async () => {
      const file = new File([new Uint8Array([0, 1, 2])], "garbage.tif");
      await expect(parseGeoTIFF(file, fetchProj4DefFake)).rejects.toThrow(
        GeoTiffError,
      );
    });

    it("rejects a truncated TIFF", async () => {
      const header = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 0]);
      const file = new File([header], "truncated.tif");
      await expect(parseGeoTIFF(file, fetchProj4DefFake)).rejects.toThrow(
        GeoTiffError,
      );
    });

    it("rejects a projected CRS with unresolvable EPSG code", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 500000, 4500000, 0],
        pixelScale: [1, 1, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
          [GeoKey.ProjectedCSType]: 30000,
        },
      });
      const error = await getInnerError(file, fetchProj4DefNull);

      expect(error).toBeInstanceOf(ProjectionError);
      expect((error as ProjectionError).code).toBe("unknownProjectionCode");
    });

    it("rejects a geographic CRS with unresolvable EPSG code", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, -4, 56, 0],
        pixelScale: [0.25, 0.25, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Geographic,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
          [GeoKey.GeographicType]: 9999,
        },
      });
      const error = await getInnerError(file, fetchProj4DefNull);

      expect(error).toBeInstanceOf(ProjectionError);
      expect((error as ProjectionError).code).toBe("unknownProjectionCode");
    });

    it("rejects a user-defined CRS (32767) with no projection parameters", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, 500000, 4500000, 0],
        pixelScale: [1, 1, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Projected,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
          [GeoKey.ProjectedCSType]: USER_DEFINED_CODE,
        },
      });
      const error = await getInnerError(file, fetchProj4DefFake);

      expect(error).toBeInstanceOf(ProjectionError);
      expect((error as ProjectionError).code).toBe("invalidCustomProjection");
    });

    it("rejects a geocentric CRS (model type 3)", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, -4, 56, 0],
        pixelScale: [0.25, 0.25, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Geocentric,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
        },
      });
      const error = await getInnerError(file, fetchProj4DefFake);

      expect(error).toBeInstanceOf(ProjectionError);
      expect((error as ProjectionError).code).toBe("cartesianProjection");
    });

    it("rejects a file with zero pixel scale", async () => {
      const file = buildFixture({
        tiepoint: [0, 0, 0, -4, 56, 0],
        pixelScale: [0, 0, 0],
        geoKeys: {
          [GeoKey.GTModelType]: ModelType.Geographic,
          [GeoKey.GTRasterType]: RasterType.PixelIsArea,
          [GeoKey.GeographicType]: 4326,
        },
      });
      const error = await getInnerError(file, fetchProj4DefFake);

      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).code).toBe("invalidResolution");
    });
  });
});

/** Calls parseGeoTIFF and returns the inner error wrapped by GeoTiffError. */
async function getInnerError(
  file: File,
  fetchProj4Def: (code: number) => Promise<string | null>,
): Promise<Error> {
  try {
    await parseGeoTIFF(file, fetchProj4Def);
    throw new Error("Expected parseGeoTIFF to throw");
  } catch (e) {
    expect(e).toBeInstanceOf(GeoTiffError);
    return (e as GeoTiffError).error;
  }
}
