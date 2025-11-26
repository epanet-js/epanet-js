import {
  CurveId,
  Curves,
  getPumpCurveType,
  ICurve,
} from "src/hydraulic-model/curves";

import { ItemData, normalizeRef } from "./inp-data";
import { IssuesAccumulator } from "./issues";

interface RawCurvePoint {
  x: number;
  y: number;
}

export class CurvesValidator {
  private typedCurves: Curves = new Map();

  constructor(
    private rawCurves: ItemData<RawCurvePoint[]>,
    private issues: IssuesAccumulator,
  ) {}

  getPumpCurveType(curveId: CurveId): "standard" | "design-point" | undefined {
    const normalizedId = normalizeRef(curveId);
    const validCurve = this.typedCurves.get(normalizedId);
    if (validCurve) return getPumpCurveType(validCurve);

    const rawCurvePoints = this.rawCurves.get(curveId);
    if (!rawCurvePoints) {
      this.issues.addUsedSection("[CURVES]");
      return;
    }

    if (this.isValidPumpCurve(rawCurvePoints)) {
      const curve: ICurve = {
        id: normalizedId,
        type: "pump",
        points: rawCurvePoints,
      };
      this.typedCurves.set(normalizedId, curve);
      return getPumpCurveType(curve);
    }

    this.issues.addUsedSection("[CURVES]");
    return;
  }

  private isValidPumpCurve(points: ICurve["points"]): boolean {
    if (points.length === 1) return true;

    const isValidStandardCurve =
      points.length === 3 &&
      points[0].x === 0 &&
      points[1].x > 0 &&
      points[1].x < points[2].x;

    return isValidStandardCurve;
  }

  getValidatedCurves(): Curves {
    return this.typedCurves;
  }
}
