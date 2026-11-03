import type { CurvePoint, CurvePointsType } from "./curves";

export interface MaybePumpCurvePoint {
  flow?: number;
  head?: number;
}

export const initialPointsFromCurve = (
  curve: CurvePoint[] | undefined,
  curveType: CurvePointsType,
): MaybePumpCurvePoint[] => {
  if (!curve || curve.length === 0) {
    return [{ flow: 0 }, {}, {}];
  }

  if (curveType === "designPointCurve") {
    const middleIndex = Math.floor(curve.length / 2);
    const designPoint = curve[middleIndex] ?? curve[0];
    const designFlow = designPoint.x;
    const designHead = designPoint.y;
    return calculateCurvePoints(
      [{}, { flow: designFlow, head: designHead }, {}],
      curveType,
    );
  }

  const points: MaybePumpCurvePoint[] = [];
  for (let i = 0; i < 3; i++) {
    if (i < curve.length) {
      const { x, y } = curve[i];
      points.push({ flow: x, head: y });
    } else {
      points.push({});
    }
  }

  points[0] = { ...points[0], flow: 0 };

  return points;
};

export const calculateCurvePoints = (
  editingPoints: MaybePumpCurvePoint[],
  definitionType: CurvePointsType,
): MaybePumpCurvePoint[] => {
  if (definitionType === "standardCurve") {
    return editingPoints;
  }

  if (definitionType === "designPointCurve") {
    const { flow: designFlow, head: designHead } = editingPoints[1];

    return [
      {
        flow: 0,
        head: designHead ? designHead * 1.33 : undefined,
      },
      { flow: designFlow, head: designHead },
      {
        flow: designFlow ? designFlow * 2 : undefined,
        head: 0,
      },
    ];
  }

  return editingPoints;
};

export const extractPointsForCurveType = (
  displayPoints: MaybePumpCurvePoint[],
  curveType: CurvePointsType,
): CurvePoint[] | null => {
  if (curveType === "designPointCurve") {
    const dp = displayPoints[1];
    if (dp.flow === undefined || dp.head === undefined) return null;
    return [{ x: dp.flow, y: dp.head }];
  }

  const points: CurvePoint[] = [];
  for (const p of displayPoints) {
    if (p.flow === undefined || p.head === undefined) return null;
    points.push({ x: p.flow, y: p.head });
  }
  return points;
};

export const convertPumpCurve = (
  curve: CurvePoint[] | undefined,
  from: CurvePointsType,
  to: CurvePointsType,
): CurvePoint[] | null =>
  extractPointsForCurveType(initialPointsFromCurve(curve, from), to);
