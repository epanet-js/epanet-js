import type { Curves, ICurve } from "src/hydraulic-model/curves";
import { getDbWorker } from "./get-db-worker";
import { pointsSchema } from "./build-curves-data";
import type { CurveRow } from "./rows";

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

export const setAllCurves = async (curves: Curves): Promise<void> => {
  const rows = curvesToRows(curves);
  const worker = getDbWorker();
  await worker.setAllCurves(rows);
};
