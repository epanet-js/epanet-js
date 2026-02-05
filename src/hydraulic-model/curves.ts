export type CurveLabel = string;
export type CurveId = number;

export interface ICurve {
  id?: CurveId;
  label: CurveLabel;
  type: "pump";
  points: { x: number; y: number }[];
}

export type CurvesDeprecated = Map<CurveLabel, ICurve>;
export type Curves = Map<CurveId, ICurve>;

export const getPumpCurveType = (
  curve: ICurve,
): "design-point" | "standard" => {
  return curve.points.length === 1 ? "design-point" : "standard";
};
