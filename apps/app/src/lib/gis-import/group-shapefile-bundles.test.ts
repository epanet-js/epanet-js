import { describe, expect, it } from "vitest";
import { groupShapefileBundles } from "./group-shapefile-bundles";

function makeFile(name: string): File {
  return new File([], name);
}

describe("groupShapefileBundles", () => {
  it("separates geojson files from shapefile parts", () => {
    const files = [
      makeFile("rivers.geojson"),
      makeFile("roads.shp"),
      makeFile("roads.dbf"),
    ];
    const { geojsonFiles, shapefileBundles } = groupShapefileBundles(files);
    expect(geojsonFiles).toHaveLength(1);
    expect(geojsonFiles[0].name).toBe("rivers.geojson");
    expect(shapefileBundles).toHaveLength(1);
    expect(shapefileBundles[0].baseName).toBe("roads");
    expect(shapefileBundles[0].files).toHaveLength(2);
  });

  it("groups all parts of the same shapefile into one bundle", () => {
    const files = [
      makeFile("parcels.shp"),
      makeFile("parcels.dbf"),
      makeFile("parcels.prj"),
      makeFile("parcels.shx"),
      makeFile("parcels.cpg"),
    ];
    const { shapefileBundles } = groupShapefileBundles(files);
    expect(shapefileBundles).toHaveLength(1);
    expect(shapefileBundles[0].files).toHaveLength(5);
  });

  it("creates separate bundles for different base names", () => {
    const files = [
      makeFile("rivers.shp"),
      makeFile("roads.shp"),
      makeFile("roads.dbf"),
    ];
    const { shapefileBundles } = groupShapefileBundles(files);
    expect(shapefileBundles).toHaveLength(2);
  });

  it("groups case-insensitively by base name", () => {
    const files = [makeFile("Rivers.SHP"), makeFile("RIVERS.DBF")];
    const { shapefileBundles } = groupShapefileBundles(files);
    expect(shapefileBundles).toHaveLength(1);
    expect(shapefileBundles[0].files).toHaveLength(2);
  });

  it("accepts .json extension as geojson", () => {
    const files = [makeFile("data.json")];
    const { geojsonFiles, shapefileBundles } = groupShapefileBundles(files);
    expect(geojsonFiles).toHaveLength(1);
    expect(shapefileBundles).toHaveLength(0);
  });

  it("silently ignores unknown extensions", () => {
    const files = [makeFile("readme.txt"), makeFile("data.xlsx")];
    const { geojsonFiles, shapefileBundles } = groupShapefileBundles(files);
    expect(geojsonFiles).toHaveLength(0);
    expect(shapefileBundles).toHaveLength(0);
  });

  it("returns empty arrays for empty input", () => {
    const { geojsonFiles, shapefileBundles } = groupShapefileBundles([]);
    expect(geojsonFiles).toHaveLength(0);
    expect(shapefileBundles).toHaveLength(0);
  });
});
