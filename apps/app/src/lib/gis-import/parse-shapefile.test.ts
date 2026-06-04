import { FeatureCollection } from "geojson";
import { beforeEach, describe, expect, it, vi } from "vitest";
import shp from "shpjs";
import { GisParseError } from "./types";
import { parseShapefile } from "./parse-shapefile";

vi.mock("shpjs");

const EPSG_27700_WKT =
  'PROJCS["British_National_Grid",GEOGCS["GCS_OSGB_1936",DATUM["D_OSGB_1936",SPHEROID["Airy_1830",6377563.396,299.3249646]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",400000.0],PARAMETER["False_Northing",-100000.0],PARAMETER["Central_Meridian",-2.0],PARAMETER["Scale_Factor",0.9996012717],PARAMETER["Latitude_Of_Origin",49.0],UNIT["Meter",1.0]]';

function makeFile(name: string, content: string = ""): File {
  return new File([content], name);
}

function wgs84FeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [2.3, 48.8] },
        properties: {},
      },
    ],
  };
}

function outOfRangeFeatureCollection(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [700000, 6600000] },
        properties: {},
      },
    ],
  };
}

describe("parseShapefile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws invalid-format when no .shp file is present", async () => {
    const files = [makeFile("roads.dbf"), makeFile("roads.prj")];
    await expect(parseShapefile(files)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof GisParseError &&
        e.code === "invalid-format" &&
        e.fileName === "roads.dbf",
    );
  });

  it("throws invalid-format when shpjs throws", async () => {
    vi.mocked(shp).mockRejectedValue(new Error("corrupt file"));

    const files = [makeFile("roads.shp")];
    await expect(parseShapefile(files)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof GisParseError &&
        e.code === "invalid-format" &&
        e.fileName === "roads.shp",
    );
  });

  it("throws no-features when feature collection is empty", async () => {
    vi.mocked(shp).mockResolvedValue({
      type: "FeatureCollection",
      features: [],
    } as FeatureCollection);

    const files = [makeFile("roads.shp")];
    await expect(parseShapefile(files)).rejects.toSatisfy(
      (e: unknown) => e instanceof GisParseError && e.code === "no-features",
    );
  });

  it("returns result for valid WGS84 shapefile without .prj", async () => {
    vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

    const files = [makeFile("roads.shp"), makeFile("roads.dbf")];
    const result = await parseShapefile(files);
    expect(result.name).toBe("roads");
    expect(result.featureCollection.features).toHaveLength(1);
  });

  it("throws missing-projection when no .prj and coords are out of WGS84 range", async () => {
    vi.mocked(shp).mockResolvedValue(outOfRangeFeatureCollection());

    const files = [makeFile("roads.shp")];
    await expect(parseShapefile(files)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof GisParseError && e.code === "missing-projection",
    );
  });

  it("returns result when .prj is present, trusting shpjs reprojection", async () => {
    vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

    const files = [makeFile("roads.shp"), makeFile("roads.prj", "PROJCS[...]")];
    const result = await parseShapefile(files);
    expect(result.name).toBe("roads");
    expect(vi.mocked(shp)).toHaveBeenCalledWith(
      expect.objectContaining({ prj: "PROJCS[...]" }),
    );
  });

  describe("coordinateConversion", () => {
    it("returns undefined when no .prj is present", async () => {
      vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

      const files = [makeFile("roads.shp")];
      const result = await parseShapefile(files);
      expect(result.coordinateConversion).toBeUndefined();
    });

    it("returns converted: true for EPSG:27700 (British National Grid)", async () => {
      vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

      const files = [
        makeFile("roads.shp"),
        makeFile("roads.prj", EPSG_27700_WKT),
      ];
      const result = await parseShapefile(files);
      expect(result.coordinateConversion).toEqual({
        detected: "British_National_Grid",
        converted: true,
        fromCRS: "British_National_Grid",
      });
    });

    it("returns converted: false for WGS 84 (GEOGCS)", async () => {
      vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

      const prjContent = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984"]]';
      const files = [makeFile("roads.shp"), makeFile("roads.prj", prjContent)];
      const result = await parseShapefile(files);
      expect(result.coordinateConversion).toEqual({
        detected: "GCS_WGS_1984",
        converted: false,
        fromCRS: "GCS_WGS_1984",
      });
    });

    it("returns fromCRS Unknown for malformed WKT", async () => {
      vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

      const files = [
        makeFile("roads.shp"),
        makeFile("roads.prj", "not valid wkt"),
      ];
      const result = await parseShapefile(files);
      expect(result.coordinateConversion).toEqual({
        detected: "Unknown",
        converted: true,
        fromCRS: "Unknown",
      });
    });
  });
});
