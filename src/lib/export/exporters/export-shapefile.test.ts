// @vitest-environment jsdom
import JSZip from "jszip";
import { ExportEntry } from "../types";
import { exportShapefile } from "./export-shapefile";

describe("export-shapefile", () => {
  it("produces a valid zip containing shapefile components", async () => {
    const entry: ExportEntry = {
      format: "shapefile",
      name: "junction",
      data: [{ id: 1, geometry: { type: "Point", coordinates: [0, 0] } }],
    };

    const [exported] = await exportShapefile(entry);

    const zip = await JSZip.loadAsync(exported.blob);
    const fileNames = Object.keys(zip.files);
    expect(fileNames.some((f) => f.startsWith("junction/"))).toBe(true);
    expect(fileNames.some((f) => f.endsWith(".shp"))).toBe(true);
    expect(fileNames.some((f) => f.endsWith(".dbf"))).toBe(true);
    expect(fileNames.some((f) => f.endsWith(".shx"))).toBe(true);

    expect(exported.fileName).toBe("junction.zip");
    expect(exported.extensions).toEqual([".zip"]);
    expect(exported.mimeTypes).toEqual(["application/zip"]);
    expect(exported.description).toBe("Shapefile");
  });
});
