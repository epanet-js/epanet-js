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
    shapefile: FileExporters.exportShapefile,
    csv: nullExporter,
    xlsx: nullExporter,
  };

  const exportedFiles = await Promise.all(
    entries.map((entry) => exporters[entry.format](entry)),
  );

  if (exportedFiles.length === 1) {
    return exportedFiles[0];
  }

  return await FileExporters.exportZip(fileName, exportedFiles);
};
