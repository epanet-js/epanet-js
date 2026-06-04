// Minimal replacement types for removed convert system

export interface ExportOptions {
  type: "inp";
}

export interface ConvertResult {
  features: any[];
  notes?: string[];
}
