import Papa from "papaparse";
import type { PatternType, Patterns } from "src/hydraulic-model";
import { formatSecondsToDisplay } from "src/components/form/time-field";

export type PatternTypeLabels = Record<PatternType, string>;

export type ExportPatternsOptions = {
  typeLabels: PatternTypeLabels;
  intervalSeconds: number;
  headers: {
    patternName: string;
    type: string;
    interval: string;
    multipliers: string;
  };
};

export type Row = (string | number | null)[];

export const buildPatternRows = (
  patterns: Patterns,
  { typeLabels, intervalSeconds, headers }: ExportPatternsOptions,
): Row[] => {
  const interval = formatSecondsToDisplay(intervalSeconds);

  const header: Row = [
    headers.patternName,
    headers.type,
    headers.interval,
    headers.multipliers,
  ];

  const rows = [...patterns.values()].map(
    (pattern): Row => [
      pattern.label,
      pattern.type ? typeLabels[pattern.type] : "",
      interval,
      ...pattern.multipliers,
    ],
  );

  return [header, ...rows];
};

export const serializePatternsToCsv = (
  patterns: Patterns,
  options: ExportPatternsOptions,
): string => Papa.unparse(buildPatternRows(patterns, options));

export const serializePatternsToXlsx = async (
  patterns: Patterns,
  options: ExportPatternsOptions,
): Promise<Uint8Array> => {
  const XLSX = await import("xlsx");
  const rows = buildPatternRows(patterns, options);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);

  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  sheet["!cols"] = rows[0].map(() => ({ wch: 22 }));
  for (let column = 0; column < rows[0].length; column++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })];
    if (cell) cell.s = { font: { bold: true } };
  }

  XLSX.utils.book_append_sheet(workbook, sheet, "Patterns");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as Uint8Array;
};
