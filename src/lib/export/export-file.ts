import { FileExporters } from "./exporters";
import { FileSystemHelpers } from "./helpers";
import type { ExportEntry, ExportedFile } from "./types";

const nullExporter = (): ExportedFile[] => [
  {
    fileName: "",
    extensions: [],
    mimeTypes: [],
    description: "",
    blob: new Blob([], { type: "text/plain" }),
  },
];

export const exportFile = async (fileName: string, entries: ExportEntry[]) => {
  const exporters = {
    geojson: FileExporters.exportGeoJson,
    shapefile: FileExporters.exportShapefile,
    csv: FileExporters.exportCsv,
    xlsx: nullExporter,
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
