import { FileExporters } from "./exporters";
import type { ExportEntry, ExportedFile } from "./types";

const nullExporter = (): ExportedFile => ({
  fileName: "",
  extensions: [],
  mimeTypes: [],
  description: "",
  blob: new Blob([], { type: "text/plain" }),
});

export const exportFile = async (
  fileName: string,
  entries: ExportEntry[],
): Promise<ExportedFile> => {
  const exporters = {
    geojson: FileExporters.exportGeoJson,
    shapefile: nullExporter,
    csv: nullExporter,
    xlsx: nullExporter,
  };
  const exportedFiles: ExportedFile[] = [];

  entries.forEach((entry) => {
    const format = entry.format;
    const file = exporters[format](entry);
    exportedFiles.push(file);
  });

  if (exportedFiles.length === 1) {
    return exportedFiles[0];
  }

  return await FileExporters.exportZip(fileName, exportedFiles);
};
