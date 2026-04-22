import { z } from "zod";
import type { CurveType, Curves, ICurve } from "src/hydraulic-model/curves";
import type { CurveRow } from "./rows";

export const pointsSchema = z.array(
  z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
);

export const buildCurvesData = (rows: CurveRow[]): Curves => {
  const curves: Curves = new Map();
  for (const row of rows) {
    const curve: ICurve = {
      id: row.id,
      label: row.label,
      points: parsePoints(row),
    };
    if (row.type !== null) curve.type = row.type as CurveType;
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
