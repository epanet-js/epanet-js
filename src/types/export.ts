// Minimal replacement types for removed convert system

export interface ExportOptions {
  type: "inp";
  folderId: string | null;
}

export interface ConvertResult {
  features: any[];
  notes?: string[];
}
