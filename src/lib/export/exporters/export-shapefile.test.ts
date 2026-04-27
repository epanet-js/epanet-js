// @vitest-environment jsdom
import { ExportEntry } from "../types";
import { exportShapefile } from "./export-shapefile";

describe("export-shapefile", () => {
  it("returns shp, shx, dbf and prj files for a point layer", async () => {
    const entry: ExportEntry = {
      format: "shapefile",
      name: "junction",
      data: [{ id: 1, geometry: { type: "Point", coordinates: [0, 0] } }],
    };

    const files = await exportShapefile(entry);
    const names = files.map((f) => f.fileName);

    expect(names).toEqual([
      "junction.shp",
      "junction.shx",
      "junction.dbf",
      "junction.prj",
    ]);
  });

  it("returns shp, shx, dbf and prj files for a line layer", async () => {
    const entry: ExportEntry = {
      format: "shapefile",
      name: "pipe",
      data: [
        {
          id: 1,
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
        },
      ],
    };

    const files = await exportShapefile(entry);
    const names = files.map((f) => f.fileName);

    expect(names).toEqual(["pipe.shp", "pipe.shx", "pipe.dbf", "pipe.prj"]);
  });

  it("each file has the correct mime type", async () => {
    const entry: ExportEntry = {
      format: "shapefile",
      name: "junction",
      data: [{ id: 1, geometry: { type: "Point", coordinates: [0, 0] } }],
    };

    const files = await exportShapefile(entry);
    const byExt = Object.fromEntries(
      files.map((f) => [f.extensions[0], f.mimeTypes[0]]),
    );

    expect(byExt[".shp"]).toBe("application/octet-stream");
    expect(byExt[".shx"]).toBe("application/octet-stream");
    expect(byExt[".dbf"]).toBe("application/octet-stream");
    expect(byExt[".prj"]).toBe("text/plain");
  });

  it("prj file contains WGS84 projection definition", async () => {
    const entry: ExportEntry = {
      format: "shapefile",
      name: "junction",
      data: [{ id: 1, geometry: { type: "Point", coordinates: [0, 0] } }],
    };

    const files = await exportShapefile(entry);
    const prj = files.find((f) => f.fileName.endsWith(".prj"))!;

    expect(await prj.blob.text()).toContain("WGS_1984");
  });

  it("returns an empty array when entry has no data", async () => {
    const entry: ExportEntry = {
      format: "shapefile",
      name: "junction",
      data: [],
    };

    const files = await exportShapefile(entry);

    expect(files).toEqual([]);
  });
});
