import { AssetId } from "./asset-types";
import { LabelManager } from "./label-manager";

export type CurveId = number;
export type CurvePoint = { x: number; y: number };

export type CurveType = "pump" | "efficiency" | "volume" | "valve" | "headloss";

export interface ICurve {
  id: CurveId;
  label: string;
  type?: CurveType;
  points: CurvePoint[];
  assetIds: Set<AssetId>;
}

export type Curves = Map<CurveId, ICurve>;

export type PumpCurveType =
  | "designPointCurve"
  | "standardCurve"
  | "multiPointCurve";

export const getPumpCurveType = (points: CurvePoint[]): PumpCurveType => {
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

export const isValidPumpCurve = (points: CurvePoint[]): boolean => {
  if (points.length === 0) return false;
  if (points.length === 1) return points[0].x !== 0 && points[0].y !== 0;
  return hasValidOrdering(points);
};

export type CurveErrorPoint = { index: number; value: "flow" | "head" };

export const getPumpCurveErrors = (points: CurvePoint[]): CurveErrorPoint[] => {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const errors: CurveErrorPoint[] = [];
    if (points[0].x === 0) errors.push({ index: 0, value: "flow" });
    if (points[0].y === 0) errors.push({ index: 0, value: "head" });
    return errors;
  }

  const errors: CurveErrorPoint[] = [];
  const seen = new Set<string>();

  const add = (index: number, value: "flow" | "head") => {
    const key = `${index}:${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push({ index, value });
    }
  };

  for (let i = 1; i < points.length; i++) {
    if (points[i].x <= points[i - 1].x) {
      add(i - 1, "flow");
      add(i, "flow");
    }
    if (points[i].y >= points[i - 1].y) {
      add(i - 1, "head");
      add(i, "head");
    }
  }

  return errors;
};

export const buildDefaultPumpCurve = (
  curves: Curves,
  labelManager: LabelManager,
  candidateLabel: string,
): ICurve => {
  const label = labelManager.isLabelAvailable(candidateLabel, "curve")
    ? candidateLabel
    : labelManager.generateNextLabel(candidateLabel);

  const id = curves.size > 0 ? Math.max(...curves.keys()) + 1 : 1;

  return {
    id,
    label,
    type: "pump",
    points: defaultCurvePoints(),
    assetIds: new Set(),
  };
};

export const defaultCurvePoints = (): CurvePoint[] => [{ x: 1, y: 1 }];
