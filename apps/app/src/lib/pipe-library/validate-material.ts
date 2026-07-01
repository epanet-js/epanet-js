import type { PipeMaterial, RoughnessEntry } from "@epanet-js/pipe-library";

export type EntryValidationError = {
  field: "age" | "roughness";
  message: string;
  value?: string;
};

export const validateEntry = (
  entry: RoughnessEntry,
): EntryValidationError[] => {
  const errors: EntryValidationError[] = [];

  if (entry.age === null && entry.roughness === null) {
    errors.push({
      field: "age",
      message: "pipeLibrary.validation.emptyEntries",
    });
    errors.push({
      field: "roughness",
      message: "pipeLibrary.validation.emptyEntries",
    });
    return errors;
  }

  if (typeof entry.age === "number" && isNaN(entry.age)) {
    errors.push({
      field: "age",
      message: "pipeLibrary.validation.mustBeNumber",
      value: String(entry.age),
    });
  }
  if (typeof entry.roughness === "number" && isNaN(entry.roughness)) {
    errors.push({
      field: "roughness",
      message: "pipeLibrary.validation.mustBeNumber",
      value: String(entry.roughness),
    });
  }
  if (errors.length > 0) return errors;

  if (entry.roughness !== null && entry.roughness <= 0) {
    errors.push({
      field: "roughness",
      message: "pipeLibrary.validation.roughnessPositive",
      value: String(entry.roughness),
    });
  }
  if (entry.age !== null && entry.age < 0) {
    errors.push({
      field: "age",
      message: "pipeLibrary.validation.agePositive",
      value: String(entry.age),
    });
  }
  if (entry.age !== null && entry.roughness === null) {
    errors.push({
      field: "roughness",
      message: "pipeLibrary.validation.roughnessRequired",
    });
  }
  if (entry.age === null && entry.roughness !== null) {
    errors.push({
      field: "age",
      message: "pipeLibrary.validation.ageRequired",
    });
  }

  return errors;
};

export type MaterialValidationError = {
  message: string;
  value?: string;
};

export const validateMaterial = (
  material: PipeMaterial,
): MaterialValidationError | null => {
  if (material.entries.length === 0) {
    return { message: "pipeLibrary.validation.emptyEntries" };
  }

  for (const entry of material.entries) {
    const errors = validateEntry(entry);
    if (errors.length > 0) {
      return { message: errors[0].message, value: errors[0].value };
    }
  }

  if (material.entries.find((e) => e.age === 0) === undefined) {
    return { message: "pipeLibrary.validation.zeroAge" };
  }

  const ages = material.entries.map((e) => e.age).filter((a) => a !== null);
  if (new Set(ages).size !== ages.length) {
    return { message: "pipeLibrary.validation.duplicateAge" };
  }

  return null;
};
