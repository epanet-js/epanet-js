import type { CurvePoint, CurveType } from "@epanet-js/hydraulic-model";
import type { ImportError, ImportStatus } from "../import-result";
import { resolveType } from "../resolve-type";
import {
  dataRowsOf,
  formatOf,
  readTableFile,
  text,
  type Cell,
  type NumberedRow,
} from "../table-file";
import type { CurveTypeLabels } from "./export-curves";

export type ParsedCurve = {
  label: string;
  type?: CurveType;
  points: CurvePoint[];
};

export type ParseCurvesResult = {
  status: ImportStatus;
  format?: "csv" | "xlsx";
  curves: ParsedCurve[];
  errors: ImportError[];
  // Rows that produced no curve. A curve occupies two rows, so this counts
  // rows rather than curves.
  ignored: number;
};

const LABEL_COLUMN = 0;
const TYPE_COLUMN = 1;
const AXIS_COLUMN = 2;
const FIRST_VALUE_COLUMN = 3;

type Axis = "x" | "y";

type AxisRow = {
  label: string;
  type?: CurveType;
  axis: Axis;
  values: number[];
  row: number;
};

const resolveAxis = (
  cell: Cell,
  labels: { x: string; y: string },
): Axis | undefined => {
  const normalized = text(cell).toLowerCase();
  if (normalized === "") return undefined;
  if (normalized === "x" || normalized === labels.x.toLowerCase()) return "x";
  if (normalized === "y" || normalized === labels.y.toLowerCase()) return "y";
  return undefined;
};

// Trailing blanks are padding and are ignored, but a gap between values would
// pair each X with the wrong Y, so it is rejected like a non-numeric cell.
const parseValues = (
  cells: Cell[],
  label: string,
  row: number,
  errors: ImportError[],
): number[] | null => {
  const values: number[] = [];

  let last = cells.length - 1;
  while (last >= FIRST_VALUE_COLUMN && text(cells[last]) === "") last -= 1;

  for (let i = FIRST_VALUE_COLUMN; i <= last; i++) {
    const raw = text(cells[i]);
    if (raw === "") {
      errors.push({ label, message: "curves.import.missingValue", row });
      return null;
    }

    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) {
      errors.push({
        label,
        message: "curves.import.invalidValue",
        value: raw,
        row,
      });
      return null;
    }
    values.push(value);
  }

  return values;
};

const readAxisRows = (
  dataRows: NumberedRow[],
  typeLabels: CurveTypeLabels,
  axisLabels: { x: string; y: string },
  errors: ImportError[],
): { rows: AxisRow[]; rejected: number } => {
  const rows: AxisRow[] = [];
  let rejected = 0;
  // Name and type may be left blank on the second row of a pair.
  let previous: { label: string; type?: CurveType } | undefined;

  for (const { cells, number } of dataRows) {
    const named = text(cells[LABEL_COLUMN]) !== "";
    const label = named ? text(cells[LABEL_COLUMN]) : previous?.label;

    if (label === undefined) {
      errors.push({ message: "curves.import.missingLabel", row: number });
      rejected += 1;
      continue;
    }

    const type = named
      ? resolveType(cells[TYPE_COLUMN], typeLabels)
      : (resolveType(cells[TYPE_COLUMN], typeLabels) ?? previous?.type);
    previous = { label, type };

    const axis = resolveAxis(cells[AXIS_COLUMN], axisLabels);
    if (axis === undefined) {
      errors.push({
        label,
        message: "curves.import.invalidAxis",
        value: text(cells[AXIS_COLUMN]),
        row: number,
      });
      rejected += 1;
      continue;
    }

    const values = parseValues(cells, label, number, errors);
    if (values === null) {
      rejected += 1;
      continue;
    }

    rows.push({ label, type, axis, values, row: number });
  }

  return { rows, rejected };
};

const pairAxes = (
  axisRows: AxisRow[],
  scope: CurveType[],
  errors: ImportError[],
): { curves: ParsedCurve[]; rejected: number } => {
  const byKey = new Map<string, { x?: AxisRow; y?: AxisRow }>();
  const order: string[] = [];

  for (const row of axisRows) {
    const key = row.label.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, {});
      order.push(key);
    }
    const pair = byKey.get(key)!;

    if (pair[row.axis]) {
      errors.push({
        label: row.label,
        message: "curves.import.duplicateAxis",
        row: row.row,
      });
      continue;
    }
    pair[row.axis] = row;
  }

  const curves: ParsedCurve[] = [];
  let rejected = 0;

  for (const key of order) {
    const { x, y } = byKey.get(key)!;
    const present = x ?? y!;

    if (!x || !y) {
      errors.push({
        label: present.label,
        message: "curves.import.unpairedAxis",
        row: present.row,
      });
      rejected += 1;
      continue;
    }

    // A blank type on one row inherits from the other, but two rows stating
    // different types leave no way to tell what the curve is.
    if (x.type && y.type && x.type !== y.type) {
      errors.push({
        label: present.label,
        message: "curves.import.conflictingTypes",
        row: y.row,
      });
      rejected += 2;
      continue;
    }

    const type = x.type ?? y.type;

    if (type && !scope.includes(type)) {
      errors.push({
        label: present.label,
        message: "curves.import.wrongDialog",
        row: x.row,
      });
      rejected += 2;
      continue;
    }

    if (x.values.length !== y.values.length) {
      errors.push({
        label: present.label,
        message: "curves.import.axisLengthMismatch",
        row: y.row,
      });
    }

    const length = Math.min(x.values.length, y.values.length);
    curves.push({
      label: present.label,
      type,
      points: Array.from({ length }, (_, i) => ({
        x: x.values[i],
        y: y.values[i],
      })),
    });
  }

  return { curves, rejected };
};

export const parseCurvesFile = async (
  file: File,
  {
    scope,
    typeLabels,
    axisLabels,
  }: {
    scope: CurveType[];
    typeLabels: CurveTypeLabels;
    axisLabels: { x: string; y: string };
  },
): Promise<ParseCurvesResult> => {
  const format = formatOf(file);

  if (!format) {
    return {
      status: "error",
      curves: [],
      ignored: 0,
      errors: [{ message: "curves.import.unsupportedFormat" }],
    };
  }

  let rows: Cell[][];

  try {
    rows = await readTableFile(file, format);
  } catch {
    return {
      status: "error",
      format,
      curves: [],
      ignored: 0,
      errors: [{ message: "fileReadError" }],
    };
  }

  const errors: ImportError[] = [];
  const dataRows = dataRowsOf(rows, FIRST_VALUE_COLUMN);
  const read = readAxisRows(dataRows, typeLabels, axisLabels, errors);
  const paired = pairAxes(read.rows, scope, errors);

  const ignored = read.rejected + paired.rejected;

  // Most rows unusable means this is the wrong kind of file rather than a
  // curves file with mistakes in it
  if (dataRows.length >= 2 && ignored * 2 > dataRows.length) {
    return {
      status: "error",
      format,
      curves: [],
      ignored,
      errors: [{ message: "curves.import.notAValidCurvesFile" }],
    };
  }

  return {
    status: errors.length > 0 ? "partial" : "success",
    format,
    curves: paired.curves,
    ignored,
    errors,
  };
};
