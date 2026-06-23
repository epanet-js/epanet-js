export type RoughnessEntry = {
  age: number | null;
  roughness: number | null;
};

export type PipeMaterial = {
  id: number;
  label: string;
  entries: RoughnessEntry[];
};
