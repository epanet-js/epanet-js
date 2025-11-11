import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { deactivateAssets } from "./deactivate-assets";

describe("deactivateAssets", () => {
  it("deactivates a single link", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(3);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
    expect(putAssets!.every((a) => !a.isActive)).toBe(true);
  });

  it("deactivates link and orphaned node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P2],
    });

    expect(putAssets).toHaveLength(2);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J3, IDS.P2]);
    expect(putAssets!.every((a) => !a.isActive)).toBe(true);
  });

  it("node with multiple active links: deactivating one link does not deactivate node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(2);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.P1]);
  });

  it("node with multiple active links: deactivating all links deactivates node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1, IDS.P2],
    });

    expect(putAssets).toHaveLength(5);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2]);
    expect(putAssets!.every((a) => !a.isActive)).toBe(true);
  });

  it("silently ignores node IDs in input", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.J1, IDS.P1],
    });

    expect(putAssets).toHaveLength(3);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
  });

  it("skips assets that are already inactive", () => {
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

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(0);
  });

  it("complex network: properly identifies all orphaned nodes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6, P3: 7 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aJunction(IDS.J4)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
      })
      .aPipe(IDS.P3, {
        startNodeId: IDS.J3,
        endNodeId: IDS.J4,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P2],
    });

    expect(putAssets).toHaveLength(1);
    expect(putAssets![0].id).toBe(IDS.P2);
    expect(putAssets![0].isActive).toBe(false);
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

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [],
    });

    expect(putAssets).toHaveLength(0);
  });

  it("throws error for invalid asset ID", () => {
    const hydraulicModel = HydraulicModelBuilder.with().build();

    expect(() => {
      deactivateAssets(hydraulicModel, {
        assetIds: [999],
      });
    }).toThrow("Invalid asset id 999");
  });

  it("deactivates node when last active link is deactivated even if inactive links remain", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
        isActive: false,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(3);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.P1]);
  });

  it("deactivates shared node when all connected links are deactivated together", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aJunction(IDS.J3)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J3,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1, IDS.P2],
    });

    expect(putAssets).toHaveLength(5);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2, IDS.J3, IDS.P1, IDS.P2]);
  });

  it("handles inconsistent state by deactivating orphaned nodes even when given inactive link IDs", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aJunction(IDS.J2)
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J2,
        isActive: false,
      })
      .build();

    const { putAssets } = deactivateAssets(hydraulicModel, {
      assetIds: [IDS.P1],
    });

    expect(putAssets).toHaveLength(2);
    const assetIds = putAssets!.map((a) => a.id).sort();
    expect(assetIds).toEqual([IDS.J1, IDS.J2]);
  });
});
