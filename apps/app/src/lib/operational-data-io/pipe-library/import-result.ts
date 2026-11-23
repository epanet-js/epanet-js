import type { PipeMaterial } from "@epanet-js/hydraulic-model";

export type ImportError = {
  code: string;
  material?: string;
  value?: string;
  row?: number;
};

export type ImportPipeLibraryResult = {
  status: "success" | "error" | "partial";
  format?: "csv" | "xlsx";
  pipeLibrary?: PipeMaterial[];
  errors: ImportError[];
};
