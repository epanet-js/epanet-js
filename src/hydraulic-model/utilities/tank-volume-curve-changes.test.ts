import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyMomentToModel } from "src/hydraulic-model/mutations/apply-moment";
import { changeProperties } from "src/hydraulic-model/model-operations/change-property";
import { tankVolumeCurveChanges } from "src/hydraulic-model/utilities/tank-volume-curve-changes";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { Tank } from "src/hydraulic-model/asset-types";

describe("tank volume curve changes", () => {
  it("sets minLevel, maxLevel, minVolume from curve points when volumeCurveId changes", () => {
    const IDS = { TANK: 1, CURVE: 10 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aTank(IDS.TANK, { minLevel: 0, maxLevel: 10, minVolume: 0 })
      .aCurve({
        id: IDS.CURVE,
        type: "volume",
        points: [
          { x: 2, y: 50 },
          { x: 8, y: 200 },
        ],
      })
      .build();

    const tank = model.assets.get(IDS.TANK) as Tank;
    expect(tank.minLevel).toBe(0);
    expect(tank.maxLevel).toBe(10);
    expect(tank.minVolume).toBe(0);
    expect(tank.volumeCurveId).toBeUndefined();

    // Build the changes the same way asset-data-table.tsx does
    const changes = tankVolumeCurveChanges(model.curves, IDS.CURVE);
    expect(changes).not.toBeNull();

    const moment = changeProperties(model, {
      assetIds: [IDS.TANK],
      changes: changes!,
    });

    applyMomentToModel(model, moment, labelManager);

    const updatedTank = model.assets.get(IDS.TANK) as Tank;
    expect(updatedTank.volumeCurveId).toBe(IDS.CURVE);
    expect(updatedTank.minLevel).toBe(2); // curve.points[0].x
    expect(updatedTank.maxLevel).toBe(8); // curve.points[last].x
    expect(updatedTank.minVolume).toBe(50); // curve.points[0].y
  });
});
