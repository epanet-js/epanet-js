import { HydraulicModel } from "src/hydraulic-model";
import { FileExporters } from "./exporters";
import { FileSystemHelpers } from "./helpers";
import type { ExportFormat } from "./types";
import { ResultsReader } from "src/simulation";

export const exportAssetData = async (
  fileName: string,
  format: ExportFormat,
  hydraulicModel: HydraulicModel,
  includeSimulationResults: boolean,
  resultsReader?: ResultsReader,
) => {
  const exporters = {
    geojson: FileExporters.exportGeoJson,
    csv: FileExporters.exportCsv,
  };

  const exportedFiles = exporters[format](
    hydraulicModel,
    includeSimulationResults,
    resultsReader,
  );

  const zipFileName = `${fileName}.zip`;
  const handle = FileSystemHelpers.isFileSystemAccessSupported()
    ? await FileSystemHelpers.openFileInFileSystem(zipFileName)
    : await FileSystemHelpers.openFileInOpfs(zipFileName);

  await FileExporters.exportZip(handle, exportedFiles);

  if (!FileSystemHelpers.isFileSystemAccessSupported()) {
    await FileSystemHelpers.triggerDownload(zipFileName, handle);
  }
};
