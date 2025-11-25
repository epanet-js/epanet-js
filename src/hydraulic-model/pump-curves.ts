export type CurveId = string;

export type PumpCurve = {
  type: "design-point" | "standard";
  points: { flow: number; head: number }[];
};

export type PumpCurvesData = Map<CurveId, PumpCurve>;

export class PumpCurves {
  private curves: PumpCurvesData = new Map();

  private normalizeId(id: string): string {
    return id.toUpperCase();
  }

  addCurve(curveId: CurveId, points: { x: number; y: number }[]): boolean {
    if (points.length === 1) {
      const curve: PumpCurve = {
        type: "design-point",
        points: [{ flow: points[0].x, head: points[0].y }],
      };
      this.curves.set(this.normalizeId(curveId), curve);
      return true;
    } else if (points.length === 3) {
      if (points[0].x !== 0) {
        return false;
      }
      if (points[1].x <= 0 || points[2].x <= points[1].x) {
        return false;
      }

      const curve: PumpCurve = {
        type: "standard",
        points: points.map((p) => ({ flow: p.x, head: p.y })),
      };
      this.curves.set(this.normalizeId(curveId), curve);
      return true;
    }

    return false;
  }

  get(curveId: CurveId): PumpCurve | undefined {
    return this.curves.get(this.normalizeId(curveId));
  }

  has(curveId: CurveId): boolean {
    return this.curves.has(this.normalizeId(curveId));
  }

  getData(): PumpCurvesData {
    return this.curves;
  }
}
