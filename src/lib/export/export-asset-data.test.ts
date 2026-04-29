import { exportAssetData } from "./export-asset-data";
import { FileExporters } from "./exporters";
import { ExportEntry } from "./types";

import { FileSystemHelpers } from "./helpers";

const mockHandle = {} as FileSystemFileHandle;

describe("export-asset-data", () => {
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

    await exportAssetData("export", [
      geoJsonEntry("nodes"),
      geoJsonEntry("pipes"),
    ]);

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

    await exportAssetData("export", [geoJsonEntry("nodes")]);

    expect(FileSystemHelpers.openFileInFileSystem).toHaveBeenCalledWith(
      "export.zip",
    );
    expect(FileSystemHelpers.openFileInOpfs).not.toHaveBeenCalled();
    expect(FileSystemHelpers.triggerDownload).not.toHaveBeenCalled();
  });

  it("uses OPFS and triggers download when native file system is not supported", async () => {
    mockGeoJsonExporter(["nodes.geojson"]);

    await exportAssetData("export", [geoJsonEntry("nodes")]);

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith("export.zip");
    expect(FileSystemHelpers.openFileInFileSystem).not.toHaveBeenCalled();
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "export.zip",
      mockHandle,
    );
  });

  it("passes-through data to the appropriate exporter", async () => {
    mockGeoJsonExporter(["nodes.geojson"]);
    mockCsvExporter(["pipes.zip"]);
    const geojson = geoJsonEntry("nodes");
    const shapefile = csvEntry("pipes");

    await exportAssetData("export", [geojson, shapefile]);

    expect(FileExporters.exportGeoJson).toHaveBeenCalledWith(geojson);
    expect(FileExporters.exportCsv).toHaveBeenCalledWith(shapefile);
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

function mockCsvExporter(files: string[]) {
  files.forEach((file) => {
    vi.spyOn(FileExporters, "exportCsv").mockResolvedValue([
      {
        fileName: file,
        extensions: [".csv"],
        mimeTypes: ["text/csv"],
        description: "CSV File",
        blob: new Blob([], { type: "text/csv" }),
      },
    ]);
  });
}

function csvEntry(name: string): ExportEntry {
  return { format: "csv", name, data: [{ id: 1 }] };
}

function geoJsonEntry(name: string): ExportEntry {
  return { format: "geojson", name, data: [{ id: 1 }] };
}
