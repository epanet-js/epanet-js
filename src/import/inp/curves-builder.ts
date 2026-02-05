import {
  CurveLabel,
  CurvesDeprecated,
  ICurve,
} from "src/hydraulic-model/curves";

import { ItemData, normalizeRef } from "./inp-data";
import { IssuesAccumulator } from "./issues";
import { DefaultQuantities } from "src/hydraulic-model/asset-builder";

interface RawCurvePoint {
  x: number;
  y: number;
}

export class CurvesBuilder {
  private typedCurves: CurvesDeprecated = new Map();

  constructor(
    private rawCurves: ItemData<RawCurvePoint[]>,
    private issues: IssuesAccumulator,
    private defaults: DefaultQuantities,
  ) {}

  getPumpCurve(curveId: CurveLabel): ICurve {
    const normalizedId = normalizeRef(curveId);
    const validCurve = this.typedCurves.get(normalizedId);
    if (validCurve) return validCurve;

    const rawCurvePoints =
      this.rawCurves.get(curveId) || this.defaultPumpCurvePoints;

    if (this.isValidPumpCurve(rawCurvePoints)) {
      const curve: ICurve = {
        label: normalizedId,
        type: "pump",
        points: rawCurvePoints,
      };
      this.typedCurves.set(normalizedId, curve);
      return curve;
    } else {
      const middleIndex = Math.floor(rawCurvePoints.length / 2);
      const designPoint = rawCurvePoints[middleIndex];
      const curve: ICurve = {
        label: normalizedId,
        type: "pump",
        points: [designPoint],
      };
      this.typedCurves.set(normalizedId, curve);

      this.issues.addPumpCurve();
      return curve;
    }
  }

  private get defaultPumpCurvePoints() {
    const designFlow = this.defaults.pump["designFlow"] || 0;
    const designHead = this.defaults.pump["designHead"] || 0;

    return [{ x: designFlow, y: designHead }];
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

  getValidatedCurves(): CurvesDeprecated {
    return this.typedCurves;
  }
}
