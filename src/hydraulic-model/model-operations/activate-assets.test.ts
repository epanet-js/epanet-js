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

    const { patchAssetsAttributes } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(patchAssetsAttributes).toHaveLength(3);
    const patchIds = patchAssetsAttributes!.map((p) => p.id).sort();
    expect(patchIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
    expect(
      patchAssetsAttributes!.every(
        (p) => (p.properties as { isActive: boolean }).isActive === true,
      ),
    ).toBe(true);
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

    const { patchAssetsAttributes } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(patchAssetsAttributes).toHaveLength(0);
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

    const { patchAssetsAttributes } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1, IDS.P2],
    });

    expect(patchAssetsAttributes).toHaveLength(5);
    const patchIds = patchAssetsAttributes!.map((p) => p.id).sort();
    expect(patchIds).toEqual([IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2]);
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

    const { patchAssetsAttributes } = activateAssets(hydraulicModel, {
      assetIds: [IDS.J1, IDS.P1],
    });

    expect(patchAssetsAttributes).toHaveLength(3);
    const patchIds = patchAssetsAttributes!.map((p) => p.id).sort();
    expect(patchIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
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

    const { patchAssetsAttributes } = activateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(patchAssetsAttributes).toHaveLength(2);
    const patchIds = patchAssetsAttributes!.map((p) => p.id).sort();
    expect(patchIds).toEqual([IDS.J2, IDS.P1]);
  });

  it("returns empty patchAssetsAttributes for empty input", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const { patchAssetsAttributes } = activateAssets(hydraulicModel, {
      assetIds: [],
    });

    expect(patchAssetsAttributes).toHaveLength(0);
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
