import { gisSourceExtensions, isGisAuxiliaryFile } from "./formats";

describe("gisSourceExtensions", () => {
  it("states what an importer reads", () => {
    expect([...gisSourceExtensions]).toEqual([
      ".geojson",
      ".json",
      ".geojsonl",
      ".dxf",
      ".shp",
      ".dbf",
      ".prj",
      ".cpg",
    ]);
  });
});

describe("isGisAuxiliaryFile", () => {
  it("knows the files that come with a shapefile but are never read", () => {
    for (const name of [
      "a.shx",
      "a.sbn",
      "a.sbx",
      "a.qix",
      "a.shp.xml",
      "A.QML",
    ]) {
      expect(isGisAuxiliaryFile(name)).toBe(true);
    }
  });

  it("does not claim a file that is read, or one it does not know", () => {
    for (const name of ["a.shp", "a.dbf", "a.prj", "a.geojson", "a.txt"]) {
      expect(isGisAuxiliaryFile(name)).toBe(false);
    }
  });
});
