export type CurveId = string;

export type PumpCurve = DesignPointCurve | StandardCurve;

export type DesignPointCurve = {
  type: "design-point";
  designFlow: number;
  designHead: number;
};

export type StandardCurve = {
  type: "standard";
  points: { flow: number; head: number }[];
};

export type PumpCurvesData = Map<CurveId, PumpCurve>;
