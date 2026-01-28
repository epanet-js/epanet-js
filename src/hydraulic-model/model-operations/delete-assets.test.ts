import { describe, it, expect } from "vitest";
import { deleteAssets } from "./delete-assets";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";

describe("deleteAssets", () => {
  it("disconnects customer points when deleting pipe", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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
        demands: [{ baseDemand: 25 }],
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.P1],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toEqual([IDS.P1]);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe(IDS.CP1);
    expect(disconnectedCP.baseDemand).toBe(25);
    expect(disconnectedCP.coordinates).toEqual([2, 1]);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("disconnects customer points when deleting junction that cascades to pipe deletion", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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
        demands: [{ baseDemand: 25 }],
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.J1],
        shouldUpdateCustomerPoints: true,
      },
    );

    expect(deletedAssetIds).toContain(IDS.J1);
    expect(deletedAssetIds).toContain(IDS.P1);
    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBe(1);

    const disconnectedCP = putCustomerPoints![0];
    expect(disconnectedCP.id).toBe(IDS.CP1);
    expect(disconnectedCP.connection).toBeNull();
  });

  it("does not disconnect customer points by default", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const hydraulicModel = HydraulicModelBuilder.with()
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
        demands: [{ baseDemand: 25 }],
        coordinates: [2, 1],
        connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
      })
      .build();

    const { deleteAssets: deletedAssetIds, putCustomerPoints } = deleteAssets(
      hydraulicModel,
      {
        assetIds: [IDS.P1],
      },
    );

    expect(deletedAssetIds).toEqual([IDS.P1]);
    expect(putCustomerPoints).toBeUndefined();
  });

  describe("isActive re-evaluation", () => {
    it("keeps node active when deleting all links", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .build();

      const { putAssets } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1, IDS.P2],
      });

      expect(putAssets).not.toBeDefined();
    });

    it("keeps node active when deleting one of two active links", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aNode(IDS.J3, [20, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          isActive: true,
        })
        .build();

      const { putAssets } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(putAssets).not.toBeDefined();
    });

    it("deactivates node when deleting active link but inactive link remains", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aNode(IDS.J3, [20, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const { putAssets } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(putAssets!.length).toBe(1);
      const deactivatedNode = putAssets![0];
      expect(deactivatedNode.id).toBe(IDS.J2);
      expect(deactivatedNode.isActive).toBe(false);
    });

    it("activates orphan nodes when deleting last inactive link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const { putAssets } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.P1],
      });

      expect(putAssets).toHaveLength(2);
      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );
      expect(assetsActiveTopologyState[IDS.J1]).toBe(true);
      expect(assetsActiveTopologyState[IDS.J2]).toBe(true);
    });

    it("deactivates appropriate nodes when cascading node deletion removes links", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5, P3: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode(IDS.J1, [0, 0])
        .aNode(IDS.J2, [10, 0])
        .aNode(IDS.J3, [20, 0])
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J2,
          endNodeId: IDS.J3,
          isActive: true,
        })
        .aPipe(IDS.P3, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          isActive: false,
        })
        .build();

      const { putAssets } = deleteAssets(hydraulicModel, {
        assetIds: [IDS.J2],
      });

      expect(putAssets).toHaveLength(2);
      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );
      expect(assetsActiveTopologyState[IDS.J1]).toBe(false);
      expect(assetsActiveTopologyState[IDS.J3]).toBe(false);
    });
  });
});
