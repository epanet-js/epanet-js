import { FeatureCollection } from "geojson";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GisParseError } from "./parse-geojson-file";
import { parseShapefile } from "./parse-shapefile";

vi.mock("shpjs");

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
    const { default: shp } = await import("shpjs");
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
    const { default: shp } = await import("shpjs");
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
    const { default: shp } = await import("shpjs");
    vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

    const files = [makeFile("roads.shp"), makeFile("roads.dbf")];
    const result = await parseShapefile(files);
    expect(result.name).toBe("roads");
    expect(result.featureCollection.features).toHaveLength(1);
  });

  it("throws unsupported-crs when no .prj and coords are out of WGS84 range", async () => {
    const { default: shp } = await import("shpjs");
    vi.mocked(shp).mockResolvedValue(outOfRangeFeatureCollection());

    const files = [makeFile("roads.shp")];
    await expect(parseShapefile(files)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof GisParseError && e.code === "unsupported-crs",
    );
  });

  it("returns result when .prj is present, trusting shpjs reprojection", async () => {
    const { default: shp } = await import("shpjs");
    // shpjs handles reprojection internally — we return WGS84 coords from the mock
    vi.mocked(shp).mockResolvedValue(wgs84FeatureCollection());

    const files = [makeFile("roads.shp"), makeFile("roads.prj", "PROJCS[...]")];
    const result = await parseShapefile(files);
    expect(result.name).toBe("roads");
    // verify shpjs was called with the prj string
    const { default: shpMock } = await import("shpjs");
    expect(vi.mocked(shpMock)).toHaveBeenCalledWith(
      expect.objectContaining({ prj: "PROJCS[...]" }),
    );
  });
});
