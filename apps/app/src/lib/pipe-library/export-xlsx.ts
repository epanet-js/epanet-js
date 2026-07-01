import * as XLSX from "xlsx";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";

export const exportXlsx = async (
  materials: PipeMaterial[],
  networkName: string,
): Promise<void> => {
  const workbook = XLSX.utils.book_new();

  for (const material of materials) {
    const data: (string | number | null)[][] = [
      ["Age", "Roughness"],
      ...material.entries.map((e) => [e.age, e.roughness]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    const name = sanitizeSheetName(material.label);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const fileName = `${networkName}-pipe-library.xlsx`;

  const handle = await FileSystemHelpers.openFileInOpfs(fileName);
  const writable = await handle.createWritable();
  await writable.write(buffer);
  await writable.close();
  await FileSystemHelpers.triggerDownload(fileName, handle);
};

// Excel forbids [ ] : * ? / \ in sheet names and caps length at 31 chars.
// The xlsx library throws on violations instead of sanitizing.
const sanitizeSheetName = (label: string): string =>
  label.replace(/[[\]:*?/\\]/g, "_").slice(0, 31);
