import type { Curves, ICurve } from "src/hydraulic-model/curves";
import { pointsSchema, type CurveRow } from "./schema";

export const toCurveRow = (curve: ICurve): CurveRow => {
  const result = pointsSchema.safeParse(curve.points);
  if (!result.success) {
    throw new Error(
      `Curve ${curve.id} (${curve.label}): points must be an array of {x,y} with finite numbers — ${result.error.message}`,
    );
  }
  return {
    id: curve.id,
    label: curve.label,
    type: curve.type ?? null,
    points: JSON.stringify(result.data),
  };
};

export const curvesToRows = (curves: Curves): CurveRow[] => {
  const rows: CurveRow[] = [];
  for (const curve of curves.values()) {
    rows.push(toCurveRow(curve));
  }
  return rows;
};
