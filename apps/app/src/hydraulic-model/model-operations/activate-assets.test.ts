import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { applyOperation } from "src/__helpers__/apply-operation";
import type { HydraulicModel } from "src/hydraulic-model";
import type { AssetId } from "@epanet-js/hydraulic-model";
import { activateAssets } from "./activate-assets";

const { labelManager } = buildTestFactories();

const run = (hydraulicModel: HydraulicModel, assetIds: AssetId[]) => {
  const changeSet = activateAssets(hydraulicModel, { assetIds });
  applyOperation(hydraulicModel, changeSet, labelManager);
  return changeSet;
};

const changedIds = (changeSet: ReturnType<typeof run>) =>
  changeSet.records.map((record) => record.id as AssetId).sort();

describe("activateAssets", () => {
  it("activates an inactive link and its connected nodes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { isActive: false })
      .aJunction(IDS.J2, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const changeSet = run(hydraulicModel, [IDS.P1]);

    expect(changeSet.records).toHaveLength(3);
    const patchIds = changedIds(changeSet);
    expect(patchIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
    expect(
      changedIds(changeSet).map(
        (id) => hydraulicModel.assets.get(id)!.isActive,
      ),
    ).not.toContain(false);
  });

  it("skips assets that are already active", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const changeSet = run(hydraulicModel, [IDS.P1]);

    expect(changeSet.records).toHaveLength(0);
  });

  it("handles multiple links with shared nodes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { isActive: false })
      .aJunction(IDS.J2, { isActive: false })
      .aJunction(IDS.J3, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        isActive: false,
      })
      .build();

    const changeSet = run(hydraulicModel, [IDS.P1, IDS.P2]);

    expect(changeSet.records).toHaveLength(5);
    const patchIds = changedIds(changeSet);
    expect(patchIds).toEqual([IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2]);
  });

  it("silently ignores node IDs in input", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { isActive: false })
      .aJunction(IDS.J2, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const changeSet = run(hydraulicModel, [IDS.J1, IDS.P1]);

    expect(changeSet.records).toHaveLength(3);
    const patchIds = changedIds(changeSet);
    expect(patchIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
  });

  it("activates only one node when already active", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const changeSet = run(hydraulicModel, [IDS.P1]);

    expect(changeSet.records).toHaveLength(2);
    const patchIds = changedIds(changeSet);
    expect(patchIds).toEqual([IDS.J2, IDS.P1]);
  });

  it("returns an empty change set for empty input", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const changeSet = run(hydraulicModel, []);

    expect(changeSet.records).toHaveLength(0);
  });

  it("throws error for invalid asset ID", () => {
    const hydraulicModel = HydraulicModelBuilder.with({ labelManager }).build();

    expect(() => {
      activateAssets(hydraulicModel, {
        assetIds: [999],
      });
    }).toThrow("Invalid asset id 999");
  });
});
