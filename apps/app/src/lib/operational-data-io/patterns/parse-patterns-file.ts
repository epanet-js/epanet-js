import type { PatternType } from "src/hydraulic-model";
import { parseValueToSeconds } from "src/components/form/time-field";
import type { ImportError, ImportStatus } from "../import-result";
import { resolveType } from "../resolve-type";
import {
  dataRowsOf,
  formatOf,
  readTableFile,
  text,
  type Cell,
} from "../table-file";
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

const LABEL_COLUMN = 0;
const TYPE_COLUMN = 1;
const INTERVAL_COLUMN = 2;
const FIRST_MULTIPLIER_COLUMN = 3;

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

  const dataRows = dataRowsOf(rows, FIRST_MULTIPLIER_COLUMN);

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

export const parsePatternsFile = async (
  file: File,
  labels: PatternTypeLabels,
): Promise<ParsePatternsResult> => {
  const format = formatOf(file);

  if (!format) {
    return {
      status: "error",
      patterns: [],
      ignored: 0,
      errors: [{ message: "patterns.import.unsupportedFormat" }],
    };
  }

  let rows: Cell[][];

  try {
    rows = await readTableFile(file, format);
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
