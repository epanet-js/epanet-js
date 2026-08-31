import Papa from "papaparse";

export type Row = (string | number | null)[];

export const serializeToCsv = (rows: Row[]): string => Papa.unparse(rows);

export const serializeToXlsx = async (
  sheetName: string,
  rows: Row[],
): Promise<Uint8Array> => {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!cols"] = rows[0].map(() => ({ wch: 22 }));
  for (let column = 0; column < rows[0].length; column++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) cell.s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as Uint8Array;
};
