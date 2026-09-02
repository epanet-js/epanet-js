import type { PipeMaterial, RoughnessEntry } from "@epanet-js/hydraulic-model";

export type EntryValidationError = {
  field: "age" | "roughness";
  // Translation key relative to the pipeLibrary namespace.
  code: string;
  value?: string;
};

export const validateEntry = (
  entry: RoughnessEntry,
): EntryValidationError[] => {
  const errors: EntryValidationError[] = [];

  if (entry.age === null && entry.roughness === null) {
    errors.push({
      field: "age",
      code: "validation.emptyEntries",
    });
    errors.push({
      field: "roughness",
      code: "validation.emptyEntries",
    });
    return errors;
  }

  if (typeof entry.age === "number" && isNaN(entry.age)) {
    errors.push({
      field: "age",
      code: "validation.mustBeNumber",
      value: String(entry.age),
    });
  }
  if (typeof entry.roughness === "number" && isNaN(entry.roughness)) {
    errors.push({
      field: "roughness",
      code: "validation.mustBeNumber",
      value: String(entry.roughness),
    });
  }
  if (errors.length > 0) return errors;

  if (entry.roughness !== null && entry.roughness <= 0) {
    errors.push({
      field: "roughness",
      code: "validation.roughnessPositive",
      value: String(entry.roughness),
    });
  }
  if (entry.age !== null && entry.age < 0) {
    errors.push({
      field: "age",
      code: "validation.agePositive",
      value: String(entry.age),
    });
  }
  if (entry.age !== null && entry.roughness === null) {
    errors.push({
      field: "roughness",
      code: "validation.roughnessRequired",
    });
  }
  if (entry.age === null && entry.roughness !== null) {
    errors.push({
      field: "age",
      code: "validation.ageRequired",
    });
  }

  return errors;
};

export type MaterialValidationError = {
  code: string;
  value?: string;
};

export const validateMaterial = (
  material: PipeMaterial,
): MaterialValidationError | null => {
  if (material.entries.length === 0) {
    return { code: "validation.emptyEntries" };
  }

  for (const entry of material.entries) {
    const errors = validateEntry(entry);
    if (errors.length > 0) {
      return { code: errors[0].code, value: errors[0].value };
    }
  }

  if (material.entries.find((e) => e.age === 0) === undefined) {
    return { code: "validation.zeroAge" };
  }

  const ages = material.entries.map((e) => e.age).filter((a) => a !== null);
  if (new Set(ages).size !== ages.length) {
    return { code: "validation.duplicateAge" };
  }

  return null;
};
