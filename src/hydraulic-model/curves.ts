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
  if (points.length === 1) return "designPointCurve";
  if (points.length === 3) return "standardCurve";

  return "multiPointCurve";
};

export const isValidPumpCurve = (points: CurvePoint[]): boolean => {
  if (points.length === 0) {
    return false;
  }

  if (points.length === 1) {
    return true;
  }

  const xAlwaysIncreases = points.every((point, index) => {
    if (index === 0) return true;
    return point.x > points[index - 1].x;
  });

  const yAlwaysDecreases = points.every((point, index) => {
    if (index === 0) return true;
    return point.y < points[index - 1].y;
  });

  return xAlwaysIncreases && yAlwaysDecreases;
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
