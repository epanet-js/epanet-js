export type ImportError = {
  label?: string;
  // What went wrong, as a bare code the UI resolves against its own
  // translation namespace.
  code: string;
  value?: string;
  // 1-based position in the file as the user sees it in a spreadsheet.
  row?: number;
};

export type ImportCounts = {
  added: number;
  updated: number;
  identical: number;
  notModified: number;
};

export type ImportStatus = "success" | "error" | "partial";
