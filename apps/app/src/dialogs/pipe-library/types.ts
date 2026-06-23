export type RoughnessEntry = {
  age: number | null;
  roughness: number | null;
};

export type PipeMaterial = {
  label: string;
  entries: RoughnessEntry[];
};
