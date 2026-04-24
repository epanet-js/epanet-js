import type { ExportFormat } from "./types";

export const exportFile = (_format: ExportFormat, _data: object[]): Blob =>
  new Blob([], { type: "text/plain" });
