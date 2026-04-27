import { exportFile } from "./export-file";
import { FileExporters } from "./exporters";
import { ExportEntry } from "./types";

describe("export-file", () => {
  beforeEach(() => {});

  it("returns the file directly when there is a single entry", async () => {
    mockGeoJsonExporter(["nodes.geojson"]);

    const result = await exportFile("export", [geoJsonEntry("nodes")]);

    expect(result.fileName).toBe("nodes.geojson");
  });

  it("returns a zip when there are multiple entries", async () => {
    mockZipExporter("export.zip");
    mockGeoJsonExporter(["nodes.geojson", "pipes.geojson"]);

    const result = await exportFile("export", [
      geoJsonEntry("nodes"),
      geoJsonEntry("pipes"),
    ]);

    expect(result.fileName).toBe("export.zip");
    expect(result.mimeTypes).toEqual(["application/zip"]);
    expect(FileExporters.exportZip).toHaveBeenCalledWith(
      "export",
      expect.arrayContaining([
        expect.objectContaining({ fileName: "nodes.geojson" }),
        expect.objectContaining({ fileName: "pipes.geojson" }),
      ]),
    );
  });

  it("passes-through data to the appropriate exporter", async () => {
    mockGeoJsonExporter(["nodes.geojson"]);
    mockShapefileExporter(["pipes.zip"]);
    const geojson = geoJsonEntry("nodes");
    const shapefile = shapefileEntry("pipes");

    await exportFile("export", [geojson, shapefile]);

    expect(FileExporters.exportGeoJson).toHaveBeenCalledWith(geojson);
    expect(FileExporters.exportShapefile).toHaveBeenCalledWith(shapefile);
  });
});

function mockGeoJsonExporter(files: string[]) {
  files.forEach((file) => {
    vi.spyOn(FileExporters, "exportGeoJson").mockReturnValueOnce([
      {
        fileName: file,
        extensions: [".geojson"],
        mimeTypes: ["application/geo+json"],
        description: "GeoJSON",
        blob: new Blob([], { type: "application/geo+json" }),
      },
    ]);
  });
}

function mockShapefileExporter(files: string[]) {
  files.forEach((file) => {
    vi.spyOn(FileExporters, "exportShapefile").mockResolvedValue([
      {
        fileName: file,
        extensions: [".zip"],
        mimeTypes: ["application/zip"],
        description: "ZIP Compressed Shapefiles",
        blob: new Blob([], { type: "application/zip" }),
      },
    ]);
  });
}

function mockZipExporter(file: string) {
  vi.spyOn(FileExporters, "exportZip").mockResolvedValue({
    fileName: file,
    extensions: [".zip"],
    mimeTypes: ["application/zip"],
    description: "ZIP Compressed File",
    blob: new Blob([], { type: "application/zip" }),
  });
}

function shapefileEntry(name: string): ExportEntry {
  return { format: "shapefile", name, data: [{ id: 1 }] };
}

function geoJsonEntry(name: string): ExportEntry {
  return { format: "geojson", name, data: [{ id: 1 }] };
}
