import { FileExporters } from "./exporters";
import { FileSystemHelpers } from "./helpers";
import type { ExportEntry } from "./types";

export const exportAssetData = async (
  fileName: string,
  entries: ExportEntry[],
) => {
  const exporters = {
    geojson: FileExporters.exportGeoJson,
    csv: FileExporters.exportCsv,
  };

  const exportedFiles = (
    await Promise.all(entries.map((entry) => exporters[entry.format](entry)))
  ).flat();

  const zipFileName = `${fileName}.zip`;
  const handle = FileSystemHelpers.isFileSystemAccessSupported()
    ? await FileSystemHelpers.openFileInFileSystem(zipFileName)
    : await FileSystemHelpers.openFileInOpfs(zipFileName);

  await FileExporters.exportZip(handle, exportedFiles);

  if (!FileSystemHelpers.isFileSystemAccessSupported()) {
    await FileSystemHelpers.triggerDownload(zipFileName, handle);
  }
};
