import Papa from "papaparse";
import type { PipeMaterial } from "@epanet-js/hydraulic-model";

export const serializeMaterialsToCsv = (materials: PipeMaterial[]): string => {
  const rows = materials.flatMap((material) =>
    material.entries.map((e) => [material.label, e.age, e.roughness]),
  );

  return Papa.unparse({
    fields: ["Material Name", "Age", "Roughness"],
    data: rows,
  });
};
