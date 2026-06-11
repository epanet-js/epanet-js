import { describe, it, expect } from "vitest";
import { mergeMoments } from "./merge-moments";
import { deleteAssets } from "./delete-assets";
import { removeCustomerPoints } from "./remove-customer-points";
import { applyMomentToModel } from "src/hydraulic-model/mutations/apply-moment";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";

describe("mergeMoments", () => {
  it("drops putCustomerPoints entries that are also in deleteCustomerPoints", () => {
    const cp = { id: 1, label: "CP", coordinates: [0, 0] };
    const merged = mergeMoments(
      [
        {
          note: "side-effect put",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          putCustomerPoints: [cp as any],
        },
        {
          note: "explicit delete",
          deleteCustomerPoints: [1],
        },
      ],
      "Merged",
    );
    expect(merged?.putCustomerPoints).toBeUndefined();
    expect(merged?.deleteCustomerPoints).toEqual([1]);
  });

  it("undoes a mixed asset+CP delete restoring the CP allocation", () => {
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

    const merged = mergeMoments(
      [
        deleteAssets(model, {
          assetIds: [IDS.J1],
          shouldUpdateCustomerPoints: true,
        }),
        removeCustomerPoints(model, { customerPointIds: [IDS.CP1] }),
      ],
      "Delete junction + CP",
    );
    expect(merged).not.toBeNull();

    const reverse = applyMomentToModel(model, merged!, labelManager);

    expect(model.assets.has(IDS.J1)).toBe(false);
    expect(model.customerPoints.has(IDS.CP1)).toBe(false);

    applyMomentToModel(model, reverse, labelManager);

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
