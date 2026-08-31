export type ImportError = {
  label?: string;
  message: string;
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
