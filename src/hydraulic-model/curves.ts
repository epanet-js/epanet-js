export type CurveId = string;

export interface ICurve {
  id: CurveId;
  type: "pump";
  points: { x: number; y: number }[];
}

export type Curves = Map<CurveId, ICurve>;

export const getPumpCurveType = (
  curve: ICurve,
): "design-point" | "standard" => {
  return curve.points.length === 1 ? "design-point" : "standard";
};
