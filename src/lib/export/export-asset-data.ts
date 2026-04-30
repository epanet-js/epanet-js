import { HydraulicModel } from "src/hydraulic-model";
import { AssetExporters } from "./asset-exporters";
import { FileSystemHelpers } from "./helpers";
import type { ExportFormat } from "./types";
import { ResultsReader } from "src/simulation";

export const exportAssetData = async (
  fileName: string,
  format: ExportFormat,
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  selectedAssets: Set<number>,
  resultsReader?: ResultsReader,
) => {
  const exporters = {
    geojson: AssetExporters.exportGeoJson,
    csv: AssetExporters.exportCsv,
    shapefile: AssetExporters.exportShapefiles,
  };

  const exportedFiles = exporters[format](
    hydraulicModel,
    includeSimulationResults,
    selectedAssets,
    resultsReader,
  );

  const zipFileName = `${fileName}.zip`;
  const handle = FileSystemHelpers.isFileSystemAccessSupported()
    ? await FileSystemHelpers.openFileInFileSystem(zipFileName)
    : await FileSystemHelpers.openFileInOpfs(zipFileName);

  await AssetExporters.exportZip(handle, exportedFiles);

  if (!FileSystemHelpers.isFileSystemAccessSupported()) {
    await FileSystemHelpers.triggerDownload(zipFileName, handle);
  }
};
