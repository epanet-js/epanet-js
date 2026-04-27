import Papa from "papaparse";
import { ExportedFile, ExportEntry } from "../types";

const toCsvString = (data: object[]): string => Papa.unparse(data);

export const exportCsv = (entry: ExportEntry): ExportedFile[] => [
  {
    fileName: `${entry.name}.csv`,
    extensions: [".csv"],
    mimeTypes: ["text/csv"],
    description: "CSV",
    blob: new Blob([toCsvString(entry.data)], { type: "text/csv" }),
  },
];
