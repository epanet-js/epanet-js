import type { PipeMaterial } from "@epanet-js/hydraulic-model";

export type ImportError = {
  message: string;
  material?: string;
  value?: string;
};

export type ImportPipeLibraryResult = {
  status: "success" | "error" | "partial";
  format?: "csv" | "xlsx";
  pipeLibrary?: PipeMaterial[];
  errors: ImportError[];
};
