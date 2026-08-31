import Papa from "papaparse";

export type Cell = string | number | null | undefined;
export type Row = (string | number | null)[];

export type NumberedRow = {
  cells: Cell[];
  // 1-based position in the file as the user sees it in a spreadsheet.
  number: number;
};

export const text = (cell: Cell): string =>
  cell === null || cell === undefined ? "" : String(cell).trim();

export const isNumeric = (cell: Cell): boolean => {
  const raw = text(cell);
  return raw !== "" && Number.isFinite(Number(raw.replace(",", ".")));
};

const isBlankRow = (row: Cell[]): boolean => row.every((c) => text(c) === "");

// Rows after two consecutive blank ones are dropped: a spreadsheet's trailing
// empties must not be parsed, while single blanks stay usable as spacers. Each
// kept row carries its original position so errors can point the user at it.
export const untilDoubleBlank = (rows: Cell[][]): NumberedRow[] => {
  const kept: NumberedRow[] = [];
  let blanks = 0;

  for (const [index, row] of rows.entries()) {
    if (isBlankRow(row)) {
      blanks += 1;
      if (blanks >= 2) break;
      continue;
    }
    blanks = 0;
    kept.push({ cells: row, number: index + 1 });
  }

  return kept;
};

// The header is detected rather than assumed, so a file whose header row was
// deleted does not silently lose its first entry. A data row always carries at
// least one numeric value; a header row never does.
export const dataRowsOf = (
  rows: Cell[][],
  firstValueColumn: number,
): NumberedRow[] => {
  const body = untilDoubleBlank(rows);
  const looksLikeHeader =
    body.length > 0 && !body[0].cells.slice(firstValueColumn).some(isNumeric);

  return looksLikeHeader ? body.slice(1) : body;
};

export type TableFormat = "csv" | "xlsx";

export const formatOf = (file: File): TableFormat | undefined => {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xlsx")) return "xlsx";
  return undefined;
};

export const readTableFile = async (
  file: File,
  format: TableFormat,
): Promise<Cell[][]> => {
  if (format === "csv") {
    const contents = await file.text();
    return Papa.parse<string[]>(contents, {
      header: false,
      skipEmptyLines: false,
    }).data;
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  return XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: true,
    defval: null,
  });
};

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
