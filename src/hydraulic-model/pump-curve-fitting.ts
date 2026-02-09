import { CurvePoint, PumpCurveType } from "./curves";

const TINY = 1e-6;
const MAX_ITER = 5;
const CONV_TOL = 0.01;

interface PumpCurveCoefficients {
  a: number;
  b: number;
  c: number;
}

export function synthesizeThreePoints(designPoint: CurvePoint): CurvePoint[] {
  const { x: q, y: h } = designPoint;
  return [
    { x: 0, y: h * 1.33334 },
    { x: q, y: h },
    { x: q * 2.0, y: 0 },
  ];
}

export function fitPumpCurve(
  threePoints: CurvePoint[],
): PumpCurveCoefficients | null {
  if (threePoints.length < 3) return null;

  const q0 = threePoints[0].x;
  const h0 = threePoints[0].y;
  const q1 = threePoints[1].x;
  const h1 = threePoints[1].y;
  const q2 = threePoints[2].x;
  const h2 = threePoints[2].y;

  if (h0 < TINY) return null;
  if (h0 - h1 < TINY) return null;
  if (h1 - h2 < TINY) return null;
  if (q1 - q0 < TINY) return null;
  if (q2 - q1 < TINY) return null;

  let a = h0;
  let b = 0;
  let c = 1;
  let converged = false;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const h4 = a - h1;
    const h5 = a - h2;

    if (h4 <= TINY || h5 <= TINY) break;

    c = Math.log(h5 / h4) / Math.log(q2 / q1);

    if (c <= 0 || c > 20) break;

    b = -h4 / Math.pow(q1, c);

    if (b > 0) break;

    const a1 = h0 - b * Math.pow(q0, c);

    if (Math.abs(a1 - a) < CONV_TOL) {
      a = a1;
      converged = true;
      break;
    }

    a = a1;
  }

  if (!converged) return null;

  const bFinal = -b;
  if (bFinal < 0) return null;

  return { a, b: Math.max(0, bFinal), c };
}

export function generateSmoothPumpCurvePoints(
  points: CurvePoint[],
  curveType: PumpCurveType,
): CurvePoint[] | null {
  if (curveType === "multi-point" || points.length === 0) return null;

  const threePoints =
    curveType === "design-point" ? synthesizeThreePoints(points[0]) : points;

  const coefficients = fitPumpCurve(threePoints);
  if (!coefficients) return null;

  const { a, b, c } = coefficients;

  const qMax = Math.pow(a / b, 1 / c);
  if (!isFinite(qMax) || qMax <= 0) return null;

  const numPoints = 25;
  const smoothPoints: CurvePoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const q = (i / (numPoints - 1)) * qMax;
    const h = a - b * Math.pow(q, c);
    smoothPoints.push({ x: q, y: Math.max(h, 0) });
  }

  return smoothPoints;
}
