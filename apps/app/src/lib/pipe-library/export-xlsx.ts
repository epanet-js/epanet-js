import * as XLSX from "xlsx";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";

export const exportXlsx = async (
  materials: PipeMaterial[],
  networkName: string,
): Promise<void> => {
  const workbook = XLSX.utils.book_new();

  const data: (string | number | null)[][] = [
    ["Material Name", "Age", "Roughness"],
    ...materials.flatMap((material) =>
      material.entries.map((e) => [material.label, e.age, e.roughness]),
    ),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, sheet, "Materials");

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const fileName = `${networkName}-pipe-library.xlsx`;

  const handle = await FileSystemHelpers.openFileInOpfs(fileName);
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
  await FileSystemHelpers.triggerDownload(fileName, handle);
};
