import type { PipeMaterial } from "@epanet-js/hydraulic-model";

export const serializeMaterialsToXlsx = async (
  materials: PipeMaterial[],
): Promise<Uint8Array> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  const data: (string | number | null)[][] = [
    ["Material Name", "Age", "Roughness"],
    ...materials.flatMap((material) =>
      material.entries.map((e) => [material.label, e.age, e.roughness]),
    ),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, "Materials");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as Uint8Array;
};
