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

export const pipeMaterialKey = (label: string): string => label.toLowerCase();

export const findPipeMaterial = (
  materials: Iterable<PipeMaterial>,
  label: string,
): PipeMaterial | undefined => {
  const key = pipeMaterialKey(label);
  for (const material of materials) {
    if (pipeMaterialKey(material.label) === key) return material;
  }
  return undefined;
};
