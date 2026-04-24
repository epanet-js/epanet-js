import type { ExportFormat, ExportEntry, ExportedFile } from "./types";

export const exportFile = (
  _format: ExportFormat,
  fileName: string,
  _data: ExportEntry[],
): ExportedFile => ({
  fileName: `${fileName}.txt`,
  description: "File",
  extensions: [".txt"],
  mimeTypes: ["text/plain"],
  blob: new Blob(["hello world"], { type: "text/plain" }),
});
