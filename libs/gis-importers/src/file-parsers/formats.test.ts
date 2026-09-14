import { gisSourceExtensions } from "./formats";

describe("gisSourceExtensions", () => {
  it("states what an importer reads", () => {
    expect([...gisSourceExtensions]).toEqual([
      ".geojson",
      ".json",
      ".geojsonl",
      ".shp",
      ".dbf",
      ".prj",
      ".cpg",
    ]);
  });
});
