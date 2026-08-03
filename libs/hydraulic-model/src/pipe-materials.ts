export type RoughnessEntry = {
  age: number | null;
  roughness: number | null;
};

export type PipeMaterial = {
  label: string;
  entries: RoughnessEntry[];
};

export const DEFAULT_ROUGHNESS_HW = 140;
export const DEFAULT_ROUGHNESS_DW_CM = 0.01;
