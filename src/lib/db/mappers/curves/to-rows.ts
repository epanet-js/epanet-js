import type { Curves, ICurve } from "src/hydraulic-model/curves";
import { curveRowSchema, pointsSchema, type CurveRow } from "./schema";

export const toCurveRow = (curve: ICurve): CurveRow => {
  const pointsResult = pointsSchema.safeParse(curve.points);
  if (!pointsResult.success) {
    throw new Error(
      `Curve ${curve.id} (${curve.label}): points must be an array of {x,y} with finite numbers — ${pointsResult.error.message}`,
    );
  }
  const candidate = {
    id: curve.id,
    label: curve.label,
    type: curve.type ?? null,
    points: JSON.stringify(pointsResult.data),
  };
  const rowResult = curveRowSchema.safeParse(candidate);
  if (!rowResult.success) {
    throw new Error(
      `Curve ${curve.id} (${curve.label}): row does not match schema — ${rowResult.error.message}`,
    );
  }
  return rowResult.data;
};

export const curvesToRows = (curves: Curves): CurveRow[] => {
  const rows: CurveRow[] = [];
  for (const curve of curves.values()) {
    rows.push(toCurveRow(curve));
  }
  return rows;
};
