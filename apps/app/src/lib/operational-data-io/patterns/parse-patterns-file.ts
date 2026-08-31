import Papa from "papaparse";
import type { PatternType } from "src/hydraulic-model";
import { parseValueToSeconds } from "src/components/form/time-field";
import type { ImportError, ImportStatus } from "../import-result";
import type { PatternTypeLabels } from "./export-patterns";

export type ParsedPattern = {
  label: string;
  type?: PatternType;
  intervalSeconds?: number;
  multipliers: number[];
};

export type ParsePatternsResult = {
  status: ImportStatus;
  format?: "csv" | "xlsx";
  patterns: ParsedPattern[];
  errors: ImportError[];
  // Rows that produced no pattern, which is not the same as errors.length:
  // repeats of one label are reported once but ignored individually.
  ignored: number;
};

type Cell = string | number | null | undefined;

const LABEL_COLUMN = 0;
const TYPE_COLUMN = 1;
const INTERVAL_COLUMN = 2;
const FIRST_MULTIPLIER_COLUMN = 3;

const text = (cell: Cell): string =>
  cell === null || cell === undefined ? "" : String(cell).trim();

const isBlankRow = (row: Cell[]): boolean => row.every((c) => text(c) === "");

export const resolveType = (
  cell: Cell,
  labels: PatternTypeLabels,
): PatternType | undefined => {
  const normalized = text(cell).toLowerCase().replace(/\s+/g, " ");
  if (normalized === "") return undefined;

  const entries = Object.entries(labels) as [PatternType, string][];
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ");

  const byKey = entries.find(([type]) => normalize(type) === normalized);
  if (byKey) return byKey[0];

  const byLabel = entries.find(([, label]) => normalize(label) === normalized);
  if (byLabel) return byLabel[0];

  // Containment either way, so both an abbreviation ("speed") and a phrase
  // built around the label ("Pump speed pattern") resolve. A cell matching
  // more than one type is left uncategorized rather than guessed at.
  const partial = entries.filter(([, label]) => {
    const candidate = normalize(label);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
  return partial.length === 1 ? partial[0][0] : undefined;
};

type NumberedRow = { cells: Cell[]; number: number };

const untilDoubleBlank = (rows: Cell[][]): NumberedRow[] => {
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

const parseMultipliers = (
  cells: Cell[],
  label: string,
  row: number,
  errors: ImportError[],
): number[] | null => {
  const multipliers: number[] = [];

  // Trailing blanks are padding and are ignored, but a gap between values
  // would pull every later multiplier onto the wrong timestep, so it is
  // rejected just like a non-numeric cell.
  let lastValue = cells.length - 1;
  while (
    lastValue >= FIRST_MULTIPLIER_COLUMN &&
    text(cells[lastValue]) === ""
  ) {
    lastValue -= 1;
  }

  for (let i = FIRST_MULTIPLIER_COLUMN; i <= lastValue; i++) {
    const raw = text(cells[i]);
    if (raw === "") {
      errors.push({
        label,
        message: "patterns.import.missingMultiplier",
        row,
      });
      return null;
    }

    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) {
      errors.push({
        label,
        message: "patterns.import.invalidMultiplier",
        value: raw,
        row,
      });
      return null;
    }
    multipliers.push(value);
  }

  return multipliers;
};

const isNumeric = (cell: Cell): boolean => {
  const raw = text(cell);
  return raw !== "" && Number.isFinite(Number(raw.replace(",", ".")));
};

const looksLikeHeader = (row: Cell[]): boolean =>
  !row.slice(FIRST_MULTIPLIER_COLUMN).some(isNumeric);

const buildPatterns = (
  rows: Cell[][],
  labels: PatternTypeLabels,
): {
  patterns: ParsedPattern[];
  errors: ImportError[];
  rowCount: number;
} => {
  const errors: ImportError[] = [];
  const byKey = new Map<string, ParsedPattern>();
  const reportedDuplicates = new Set<string>();

  const body = untilDoubleBlank(rows);
  const dataRows =
    body.length > 0 && looksLikeHeader(body[0].cells) ? body.slice(1) : body;

  for (const { cells, number } of dataRows) {
    const label = text(cells[LABEL_COLUMN]);
    if (label === "") {
      errors.push({ message: "patterns.import.missingLabel", row: number });
      continue;
    }

    const key = label.toLowerCase();
    if (byKey.has(key)) {
      if (!reportedDuplicates.has(key)) {
        reportedDuplicates.add(key);
        errors.push({
          label,
          message: "patterns.import.duplicateLabel",
          row: number,
        });
      }
      continue;
    }

    // Interval may be left empty, but a value that is there must be readable.
    const intervalCell = text(cells[INTERVAL_COLUMN]);
    const intervalSeconds = parseValueToSeconds(intervalCell);
    if (intervalCell !== "" && intervalSeconds === undefined) {
      errors.push({
        label,
        message: "patterns.import.invalidInterval",
        value: intervalCell,
        row: number,
      });
      continue;
    }

    const multipliers = parseMultipliers(cells, label, number, errors);
    if (multipliers === null) continue;

    byKey.set(key, {
      label,
      type: resolveType(cells[TYPE_COLUMN], labels),
      intervalSeconds,
      multipliers,
    });
  }

  return { patterns: [...byKey.values()], errors, rowCount: dataRows.length };
};

const readCsv = async (file: File): Promise<Cell[][]> => {
  const text = await file.text();
  return Papa.parse<string[]>(text, { header: false, skipEmptyLines: false })
    .data;
};

const readXlsx = async (file: File): Promise<Cell[][]> => {
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

export const parsePatternsFile = async (
  file: File,
  labels: PatternTypeLabels,
): Promise<ParsePatternsResult> => {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const isXlsx = file.name.toLowerCase().endsWith(".xlsx");

  if (!isCsv && !isXlsx) {
    return {
      status: "error",
      patterns: [],
      ignored: 0,
      errors: [{ message: "patterns.import.unsupportedFormat" }],
    };
  }

  const format = isCsv ? "csv" : "xlsx";
  let rows: Cell[][];

  try {
    rows = isCsv ? await readCsv(file) : await readXlsx(file);
  } catch {
    return {
      status: "error",
      format,
      patterns: [],
      ignored: 0,
      errors: [{ message: "fileReadError" }],
    };
  }

  const { patterns, errors, rowCount } = buildPatterns(rows, labels);

  // Most rows unusable means this is the wrong kind of file rather than a
  // patterns file with mistakes in it
  const rejectedRows = rowCount - patterns.length;
  if (rowCount >= 2 && rejectedRows * 2 > rowCount) {
    return {
      status: "error",
      format,
      patterns: [],
      ignored: rejectedRows,
      errors: [{ message: "patterns.import.notAValidPatternsFile" }],
    };
  }

  return {
    status: errors.length > 0 ? "partial" : "success",
    format,
    patterns,
    ignored: rejectedRows,
    errors,
  };
};
