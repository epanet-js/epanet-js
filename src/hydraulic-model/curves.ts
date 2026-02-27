import { LabelManager } from "./label-manager";

export type CurveId = number;
export type CurvePoint = { x: number; y: number };

export type CurveType = "pump" | "efficiency" | "volume" | "valve" | "headloss";

export interface ICurve {
  id: CurveId;
  label: string;
  type?: CurveType;
  points: CurvePoint[];
}

export type Curves = Map<CurveId, ICurve>;

export type CurvePointsType =
  | "designPointCurve"
  | "standardCurve"
  | "multiPointCurve";

export const getCurvePointsType = (points: CurvePoint[]): CurvePointsType => {
  if (points.length === 1 && points[0].x !== 0 && points[0].y !== 0)
    return "designPointCurve";
  if (points.length === 3 && points[0].x === 0 && hasValidOrdering(points))
    return "standardCurve";

  return "multiPointCurve";
};

const hasValidOrdering = (points: CurvePoint[]): boolean => {
  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) return false;
    if (points[i].y >= points[i - 1].y) return false;
  }
  return true;
};

export const isValidCurve = (points: CurvePoint[]): boolean => {
  if (points.length === 0) return false;
  if (points.length === 1) return points[0].x !== 0 && points[0].y !== 0;
  return hasValidOrdering(points);
};

export type CurveErrorPoint = { index: number; value: "x" | "y" };

export const getGenericCurveErrors = (
  points: CurvePoint[],
): CurveErrorPoint[] => {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const errors: CurveErrorPoint[] = [];
    if (points[0].x === 0) errors.push({ index: 0, value: "x" });
    if (points[0].y === 0) errors.push({ index: 0, value: "y" });
    return errors;
  }

  const errors: CurveErrorPoint[] = [];
  const seen = new Set<string>();
  const add = (index: number) => {
    const key = `${index}:x`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ index, value: "x" });
    }
  };

  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) {
      add(i - 1);
      add(i);
    }
  }
  return errors;
};

export const getPumpCurveErrors = (points: CurvePoint[]): CurveErrorPoint[] => {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const errors: CurveErrorPoint[] = [];
    if (points[0].x === 0) errors.push({ index: 0, value: "x" });
    if (points[0].y === 0) errors.push({ index: 0, value: "y" });
    return errors;
  }

  const errors: CurveErrorPoint[] = [];
  const seen = new Set<string>();

  const add = (index: number, value: "x" | "y") => {
    const key = `${index}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ index, value });
    }
  };

  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) {
      add(i - 1, "x");
      add(i, "x");
    }
    if (points[i].y >= points[i - 1].y) {
      add(i - 1, "y");
      add(i, "y");
    }
  }

  return errors;
};

/** Volume curves: X strictly increasing, Y strictly increasing.
 *  Required because EPANET's tankgrade() swaps X/Y for inverse lookup. */
export const getVolumeCurveErrors = (
  points: CurvePoint[],
): CurveErrorPoint[] => {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const errors: CurveErrorPoint[] = [];
    if (points[0].x === 0) errors.push({ index: 0, value: "x" });
    if (points[0].y === 0) errors.push({ index: 0, value: "y" });
    return errors;
  }

  const errors: CurveErrorPoint[] = [];
  const seen = new Set<string>();

  const add = (index: number, value: "x" | "y") => {
    const key = `${index}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ index, value });
    }
  };

  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) {
      add(i - 1, "x");
      add(i, "x");
    }
    if (points[i].y <= points[i - 1].y) {
      add(i - 1, "y");
      add(i, "y");
    }
  }

  return errors;
};

/** Headloss curves (GPV): X strictly increasing, Y non-decreasing.
 *  EPANET's gpvcoeff() clamps negative slopes to TINY. */
export const getHeadlossCurveErrors = (
  points: CurvePoint[],
): CurveErrorPoint[] => {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const errors: CurveErrorPoint[] = [];
    if (points[0].x === 0) errors.push({ index: 0, value: "x" });
    if (points[0].y === 0) errors.push({ index: 0, value: "y" });
    return errors;
  }

  const errors: CurveErrorPoint[] = [];
  const seen = new Set<string>();

  const add = (index: number, value: "x" | "y") => {
    const key = `${index}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ index, value });
    }
  };

  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) {
      add(i - 1, "x");
      add(i, "x");
    }
    if (points[i].y < points[i - 1].y) {
      add(i - 1, "y");
      add(i, "y");
    }
  }

  return errors;
};

/** Valve curves (PCV): X strictly increasing, Y strictly increasing. */
export const getValveCurveErrors = getVolumeCurveErrors;

/** Efficiency curves: X strictly increasing (Y unconstrained — bell-shaped). */
export const getEfficiencyCurveErrors = getGenericCurveErrors;

export const buildDefaultPumpCurve = (
  curves: Curves,
  labelManager: LabelManager,
  candidateLabel: string,
): ICurve => {
  return buildDefaultCurve(curves, labelManager, candidateLabel, "pump");
};

export const buildDefaultCurve = (
  curves: Curves,
  labelManager: LabelManager,
  candidateLabel: string,
  type: CurveType,
): ICurve => {
  const label = labelManager.isLabelAvailable(candidateLabel, "curve")
    ? candidateLabel
    : labelManager.generateNextLabel(candidateLabel);

  const id = curves.size > 0 ? Math.max(...curves.keys()) + 1 : 1;

  return {
    id,
    label,
    type,
    points: defaultCurvePoints(),
  };
};

export const isEmptyPoint = (p: CurvePoint): boolean => p.x === 0 && p.y === 0;

export const stripTrailingEmptyPoints = (
  points: CurvePoint[],
): CurvePoint[] => {
  let last = points.length - 1;
  while (last > 0 && isEmptyPoint(points[last])) last--;
  return points.slice(0, last + 1);
};

export const defaultCurvePoints = (): CurvePoint[] => [{ x: 1, y: 1 }];

export const deepCloneCurves = (curves: Curves): Curves => {
  const cloned = new Map<CurveId, ICurve>();
  for (const [id, curve] of curves) {
    cloned.set(id, {
      ...curve,
      points: curve.points.map((p) => ({ ...p })),
    });
  }
  return cloned;
};

export const isCurveEqual = (a: ICurve, b?: ICurve): boolean => {
  if (!b) return false;
  if (a.label !== b.label) return false;
  if (a.type !== b.type) return false;
  if (a.points.length !== b.points.length) return false;
  if (
    !a.points.every(
      (p, idx) => p.x === b.points[idx].x && p.y === b.points[idx].y,
    )
  )
    return false;
  return true;
};

export const differentCurvesCount = (a: Curves, b: Curves): number => {
  const visitedIds: Set<CurveId> = new Set();
  let count = 0;

  for (const [id, aCurve] of a) {
    visitedIds.add(id);
    const bCurve = b.get(id);
    if (!isCurveEqual(aCurve, bCurve)) {
      count += 1;
    }
  }
  for (const [id, bCurve] of b) {
    if (visitedIds.has(id)) continue;
    const aCurve = a.get(id);
    if (!isCurveEqual(bCurve, aCurve)) {
      count += 1;
    }
  }
  return count;
};
