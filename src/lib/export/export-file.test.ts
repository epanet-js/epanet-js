import { exportFile } from "./export-file";
import { FileExporters } from "./exporters";
import { ExportEntry } from "./types";

import { FileSystemHelpers } from "./helpers";

const mockHandle = {} as FileSystemFileHandle;

describe("export-file", () => {
  beforeEach(() => {
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      false,
    );
    vi.spyOn(FileSystemHelpers, "openFileInOpfs").mockResolvedValue(mockHandle);
    vi.spyOn(FileSystemHelpers, "openFileInFileSystem").mockResolvedValue(
      mockHandle,
    );
    vi.spyOn(FileSystemHelpers, "triggerDownload").mockResolvedValue(undefined);
    vi.spyOn(FileExporters, "exportZip").mockResolvedValue(undefined);
  });

  it("generates a ZIP file with all entries", async () => {
    mockGeoJsonExporter(["nodes.geojson", "pipes.geojson"]);

    await exportFile("export", [geoJsonEntry("nodes"), geoJsonEntry("pipes")]);

    expect(FileExporters.exportZip).toHaveBeenCalledWith(
      mockHandle,
      expect.arrayContaining([
        expect.objectContaining({ fileName: "nodes.geojson" }),
        expect.objectContaining({ fileName: "pipes.geojson" }),
      ]),
    );
  });

  it("uses native file system handles when supported by the browser", async () => {
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      true,
    );
    mockGeoJsonExporter(["nodes.geojson"]);

    await exportFile("export", [geoJsonEntry("nodes")]);

    expect(FileSystemHelpers.openFileInFileSystem).toHaveBeenCalledWith(
      "export.zip",
    );
    expect(FileSystemHelpers.openFileInOpfs).not.toHaveBeenCalled();
    expect(FileSystemHelpers.triggerDownload).not.toHaveBeenCalled();
  });

  it("uses OPFS and triggers download when native file system is not supported", async () => {
    mockGeoJsonExporter(["nodes.geojson"]);

    await exportFile("export", [geoJsonEntry("nodes")]);

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith("export.zip");
    expect(FileSystemHelpers.openFileInFileSystem).not.toHaveBeenCalled();
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "export.zip",
      mockHandle,
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

function shapefileEntry(name: string): ExportEntry {
  return { format: "shapefile", name, data: [{ id: 1 }] };
}

function geoJsonEntry(name: string): ExportEntry {
  return { format: "geojson", name, data: [{ id: 1 }] };
}
