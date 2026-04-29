import type { Curves, ICurve } from "src/hydraulic-model/curves";
import { parseRows } from "../parse-rows";
import { pointsSchema, curveRowSchema, type CurveRow } from "./schema";

export const buildCurvesData = (rawRows: unknown[]): Curves => {
  const rows = parseRows(curveRowSchema, rawRows, "Curves");
  const curves: Curves = new Map();
  for (const row of rows) {
    const curve: ICurve = {
      id: row.id,
      label: row.label,
      points: parsePoints(row),
    };
    if (row.type !== null) curve.type = row.type;
    curves.set(row.id, curve);
  }
  return curves;
};

const parsePoints = (row: CurveRow) => {
  let raw: unknown;
  try {
    raw = JSON.parse(row.points);
  } catch (error) {
    throw new Error(
      `Curve ${row.id} (${row.label}): points is not valid JSON`,
      { cause: error },
    );
  }
  const result = pointsSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Curve ${row.id} (${row.label}): points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return result.data;
};
