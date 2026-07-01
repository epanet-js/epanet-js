import Papa from "papaparse";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import { FileSystemHelpers } from "src/lib/export/file-system-helpers";

export const exportCsv = async (
  materials: PipeMaterial[],
  networkName: string,
): Promise<void> => {
  const rows = materials.flatMap((material) =>
    material.entries.map((e) => [material.label, e.age, e.roughness]),
  );

  const csv = Papa.unparse({
    fields: ["Material Name", "Age", "Roughness"],
    data: rows,
  });

  const fileName = `${networkName}-pipe-library.csv`;
  const handle = await FileSystemHelpers.openFileInOpfs(fileName);
  const writable = await handle.createWritable();

  await writable.write(csv);
  await writable.close();
  await FileSystemHelpers.triggerDownload(fileName, handle);
};
