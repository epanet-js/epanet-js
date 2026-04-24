import type { ExportFormat, ExportedFile } from "./types";

export const exportFile = (
  _format: ExportFormat,
  _data: ExportedFile[],
): Blob => new Blob([], { type: "text/plain" });
