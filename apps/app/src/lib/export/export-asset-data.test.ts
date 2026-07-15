import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { ResultsReader } from "src/simulation";
import { exportAssetData } from "./export-asset-data";
import { AssetExporters } from "./asset-exporters";
import { FileSystemHelpers } from "./file-system-helpers";
import { WGS84 } from "src/lib/projections";

const mockHandle = {} as FileSystemFileHandle;
const model = HydraulicModelBuilder.empty();
const translate = (key: string) => key;

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
    vi.spyOn(AssetExporters, "exportZip").mockResolvedValue(undefined);
  });

  it("generates ZIP file from exported files", async () => {
    const exportedFiles = mockGeoJsonExporter();

    await exportAssetData("export", "geojson", model, WGS84, translate);

    expect(AssetExporters.exportZip).toHaveBeenCalledWith(
      mockHandle,
      exportedFiles,
    );
  });

  it("uses native file system handle when supported by the browser", async () => {
    vi.spyOn(FileSystemHelpers, "isFileSystemAccessSupported").mockReturnValue(
      true,
    );
    mockGeoJsonExporter();

    await exportAssetData("export", "geojson", model, WGS84, translate);

    expect(FileSystemHelpers.openFileInFileSystem).toHaveBeenCalledWith(
      "export.zip",
      "ZIP File",
      "application/zip",
      ".zip",
    );
    expect(FileSystemHelpers.openFileInOpfs).not.toHaveBeenCalled();
    expect(FileSystemHelpers.triggerDownload).not.toHaveBeenCalled();
  });

  it("uses OPFS and triggers download when native file system is not supported", async () => {
    mockGeoJsonExporter();

    await exportAssetData("export", "geojson", model, WGS84, translate);

    expect(FileSystemHelpers.openFileInOpfs).toHaveBeenCalledWith("export.zip");
    expect(FileSystemHelpers.openFileInFileSystem).not.toHaveBeenCalled();
    expect(FileSystemHelpers.triggerDownload).toHaveBeenCalledWith(
      "export.zip",
      mockHandle,
    );
  });

  it("calls the geojson exporter for geojson format", async () => {
    const resultsReader = {} as ResultsReader;
    mockGeoJsonExporter();

    const options = {
      includeSimulationResults: true,
      resultsReader,
    };

    await exportAssetData(
      "export",
      "geojson",
      model,
      WGS84,
      translate,
      options,
    );

    expect(AssetExporters.exportGeoJson).toHaveBeenCalledWith(
      model,
      WGS84,
      translate,
      options,
    );
  });

  it("calls the csv exporter for csv format", async () => {
    const resultsReader = {} as ResultsReader;
    mockCsvExporter();

    const options = {
      includeSimulationResults: true,
      resultsReader,
    };

    await exportAssetData("export", "csv", model, WGS84, translate, options);

    expect(AssetExporters.exportCsv).toHaveBeenCalledWith(
      model,
      WGS84,
      translate,
      options,
    );
  });
});

function mockGeoJsonExporter() {
  const files = [
    {
      fileName: "junction.geojson",
      extensions: [".geojson"],
      mimeTypes: ["application/geo+json"],
      description: "GeoJSON File",
      blob: new Blob([], { type: "application/geo+json" }),
    },
  ];
  vi.spyOn(AssetExporters, "exportGeoJson").mockReturnValue(files);
  return files;
}

function mockCsvExporter() {
  const files = [
    {
      fileName: "junction.csv",
      extensions: [".csv"],
      mimeTypes: ["text/csv"],
      description: "CSV File",
      blob: new Blob([], { type: "text/csv" }),
    },
  ];
  vi.spyOn(AssetExporters, "exportCsv").mockReturnValue(files);
  return files;
}
