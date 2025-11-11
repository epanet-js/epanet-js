import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { activateAssets } from "./activate-assets";

describe("activateAssets", () => {
  it("activates an inactive link and its connected nodes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { isActive: false })
      .aJunction(IDS.J2, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const { putAssets } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(3);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
    expect(putAssets!.every((a) => a.isActive)).toBe(true);
  });

  it("skips assets that are already active", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const { putAssets } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(0);
  });

  it("handles multiple links with shared nodes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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

    const { putAssets } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1, IDS.P2],
    });

    expect(putAssets).toHaveLength(5);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2]);
    expect(putAssets!.every((a) => a.isActive)).toBe(true);
  });

  it("silently ignores node IDs in input", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { isActive: false })
      .aJunction(IDS.J2, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const { putAssets } = activateAssets(hydraulicModel, {
      assetIds: [IDS.J1, IDS.P1],
    });

    expect(putAssets).toHaveLength(3);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
  });

  it("activates only one node when already active", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2, { isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const { putAssets } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(2);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J2, IDS.P1]);
  });

  it("returns empty putAssets for empty input", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const { putAssets } = activateAssets(hydraulicModel, {
      assetIds: [],
    });

    expect(putAssets).toHaveLength(0);
  });

  it("throws error for invalid asset ID", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    expect(() => {
      activateAssets(hydraulicModel, {
        assetIds: [999],
      });
    }).toThrow("Invalid asset id 999");
  });
});
