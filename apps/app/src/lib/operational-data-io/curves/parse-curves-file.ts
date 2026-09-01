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

// Replacement translation keys, keyed by the message they replace.
export type CodeOverrides = Record<string, string>;

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
  // Curves the file named that produced nothing. A curve spans two rows, so
  // a curve broken on both of them still counts once.
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
      errors.push({ label, code: "missingValue", row });
      return null;
    }

    const value = Number(raw.replace(",", "."));
    if (!Number.isFinite(value)) {
      errors.push({
        label,
        code: "invalidValue",
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
): {
  rows: AxisRow[];
  // Rows dropped before pairing, for the is-this-even-a-curves-file check.
  rejected: number;
  // Every curve the file names, whether or not its rows survived.
  labels: Set<string>;
  // Rows that name no curve at all, so they belong to none of the above.
  unlabeled: number;
  // Curves that already lost a row here, and whose surviving row must not be
  // reported again for the pairing it can no longer make.
  rejectedLabels: Set<string>;
} => {
  const rows: AxisRow[] = [];
  const labels = new Set<string>();
  const rejectedLabels = new Set<string>();
  let rejected = 0;
  let unlabeled = 0;
  // Name and type may be left blank on the second row of a pair.
  let previous: { label: string; type?: CurveType } | undefined;

  for (const { cells, number } of dataRows) {
    const named = text(cells[LABEL_COLUMN]) !== "";
    const label = named ? text(cells[LABEL_COLUMN]) : previous?.label;

    if (label === undefined) {
      errors.push({ code: "missingLabel", row: number });
      rejected += 1;
      unlabeled += 1;
      continue;
    }

    labels.add(label.toLowerCase());

    const type = named
      ? resolveType(cells[TYPE_COLUMN], typeLabels)
      : (resolveType(cells[TYPE_COLUMN], typeLabels) ?? previous?.type);
    previous = { label, type };

    const axis = resolveAxis(cells[AXIS_COLUMN], axisLabels);
    if (axis === undefined) {
      errors.push({
        label,
        code: "invalidAxis",
        value: text(cells[AXIS_COLUMN]),
        row: number,
      });
      rejected += 1;
      rejectedLabels.add(label.toLowerCase());
      continue;
    }

    const values = parseValues(cells, label, number, errors);
    if (values === null) {
      rejected += 1;
      rejectedLabels.add(label.toLowerCase());
      continue;
    }

    rows.push({ label, type, axis, values, row: number });
  }

  return { rows, rejected, labels, unlabeled, rejectedLabels };
};

const pairAxes = (
  axisRows: AxisRow[],
  scope: CurveType[],
  rejectedLabels: Set<string>,
  errors: ImportError[],
): { curves: ParsedCurve[]; malformedRows: number } => {
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
        code: "duplicateAxis",
        row: row.row,
      });
      continue;
    }
    pair[row.axis] = row;
  }

  const curves: ParsedCurve[] = [];
  // Rows whose shape was wrong. Rows merely aimed at the other library are
  // left out: they are well formed, and say nothing about the file.
  let malformedRows = 0;

  for (const key of order) {
    const { x, y } = byKey.get(key)!;
    const present = x ?? y!;

    if (!x || !y) {
      // When the missing half was rejected on its own terms, that reason has
      // already been reported and points at the row actually at fault.
      if (!rejectedLabels.has(key)) {
        errors.push({
          label: present.label,
          code: "unpairedAxis",
          row: present.row,
        });
      }
      malformedRows += 1;
      continue;
    }

    // A blank type on one row inherits from the other, but two rows stating
    // different types leave no way to tell what the curve is.
    if (x.type && y.type && x.type !== y.type) {
      errors.push({
        label: present.label,
        code: "conflictingTypes",
        row: y.row,
      });
      malformedRows += 2;
      continue;
    }

    const type = x.type ?? y.type;

    if (type && !scope.includes(type)) {
      errors.push({
        label: present.label,
        code: "wrongDialog",
        row: x.row,
      });
      continue;
    }

    // Pairing the values we do have would invent points the file never
    // stated, so a length mismatch takes the whole curve with it.
    if (x.values.length !== y.values.length) {
      errors.push({
        label: present.label,
        code: "axisLengthMismatch",
        row: y.row,
      });
      malformedRows += 2;
      continue;
    }

    curves.push({
      label: present.label,
      type,
      points: x.values.map((value, i) => ({ x: value, y: y.values[i] })),
    });
  }

  return { curves, malformedRows };
};

export const parseCurvesFile = async (
  file: File,
  {
    scope,
    typeLabels,
    axisLabels,
    codeOverrides = {},
  }: {
    scope: CurveType[];
    typeLabels: CurveTypeLabels;
    axisLabels: { x: string; y: string };
    // Lets a dialog say something more specific than the generic wording —
    // naming the library a foreign curve belongs to, for instance.
    codeOverrides?: CodeOverrides;
  },
): Promise<ParseCurvesResult> => {
  const applyOverrides = (errors: ImportError[]): ImportError[] =>
    errors.map((error) =>
      codeOverrides[error.code]
        ? { ...error, code: codeOverrides[error.code] }
        : error,
    );

  const format = formatOf(file);

  if (!format) {
    return {
      status: "error",
      curves: [],
      ignored: 0,
      errors: applyOverrides([{ code: "unsupportedFormat" }]),
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
      errors: [],
    };
  }

  const errors: ImportError[] = [];
  const dataRows = dataRowsOf(rows, FIRST_VALUE_COLUMN);
  const read = readAxisRows(dataRows, typeLabels, axisLabels, errors);
  const paired = pairAxes(read.rows, scope, read.rejectedLabels, errors);

  const malformedRows = read.rejected + paired.malformedRows;
  // Every curve the file named that we could not build, however many of its
  // rows were at fault, plus the rows that named no curve at all.
  const ignored = read.labels.size - paired.curves.length + read.unlabeled;

  // Most rows unreadable means this is the wrong kind of file. Curves meant
  // for the other library are perfectly well formed, so they are reported on
  // their own rather than counted as evidence against the file.
  if (dataRows.length >= 2 && malformedRows * 2 > dataRows.length) {
    return {
      status: "error",
      format,
      curves: [],
      ignored,
      errors: applyOverrides([{ code: "notAValidCurvesFile" }]),
    };
  }

  return {
    status: errors.length > 0 ? "partial" : "success",
    format,
    curves: paired.curves,
    ignored,
    errors: applyOverrides(errors),
  };
};
