import { describe, it, expect } from "vitest";
import { mergeChangeSets } from "./merge-change-sets";
import { deleteAssets } from "./delete-assets";
import { removeCustomerPoints } from "./remove-customer-points";
import { applyOperation } from "src/__helpers__/apply-operation";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("mergeChangeSets", () => {
  it("deletes a customer point that the asset delete disconnects, and undoes it", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const { labelManager } = buildTestFactories();
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      })
      .aCustomerPoint(IDS.CP1, {
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 25 }])
      .build();

    const merged = mergeChangeSets(
      [
        deleteAssets(model, {
          assetIds: [IDS.J1],
          shouldUpdateCustomerPoints: true,
        }),
        removeCustomerPoints(model, { customerPointIds: [IDS.CP1] }),
      ],
      "deleteSelection",
    );
    expect(merged).not.toBeNull();

    const { undo } = applyOperation(model, merged!, labelManager);

    expect(model.assets.has(IDS.J1)).toBe(false);
    expect(model.customerPoints.has(IDS.CP1)).toBe(false);

    undo();

    expect(model.assets.has(IDS.J1)).toBe(true);
    const restoredCp = model.customerPoints.get(IDS.CP1);
    expect(restoredCp).toBeDefined();
    expect(restoredCp!.connection).toEqual({
      pipeId: IDS.P1,
      junctionId: IDS.J1,
      snapPoint: expect.any(Array),
    });
    expect(model.demands.customerPoints.get(IDS.CP1)).toEqual([
      { baseDemand: 25 },
    ]);
  });
});
