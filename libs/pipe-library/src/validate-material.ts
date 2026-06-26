import { PipeMaterial } from "./types";

export const validateMaterial = (material: PipeMaterial): string | null => {
  if (material.entries.length === 0) {
    return "pipeLibrary.validation.emptyEntries";
  }

  for (const e of material.entries) {
    if (e.roughness !== null && e.roughness <= 0) {
      return "pipeLibrary.validation.roughnessPositive";
    }

    if (e.age !== null && e.age < 0) {
      return "pipeLibrary.validation.agePositive";
    }

    if (e.age !== null && e.roughness === null) {
      return "pipeLibrary.validation.roughnessRequired";
    }

    if (e.age === null && e.roughness !== null) {
      return "pipeLibrary.validation.ageRequired";
    }

    if (e.age === null && e.roughness === null) {
      return "pipeLibrary.validation.emptyEntries";
    }
  }

  if (material.entries.find((e) => e.age === 0) === undefined) {
    return "pipeLibrary.validation.zeroAge";
  }

  const ages = material.entries.map((e) => e.age).filter((a) => a !== null);
  if (new Set(ages).size !== ages.length) {
    return "pipeLibrary.validation.duplicateAge";
  }

  return null;
};
