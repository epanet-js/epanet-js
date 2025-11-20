import { describe, it, expect } from "vitest";
import { replaceLink } from "./replace-link";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Pipe, NodeAsset } from "../asset-types";
import { CustomerPoint } from "../customer-points";

describe("replaceLink", () => {
  describe("basic functionality", () => {
    it("replaces existing pipe with new pipe", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
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
          diameter: 200,
          isActive: true,
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [5, 5],
          [10, 0],
        ],
      });
      newPipe.setProperty("id", IDS.P2);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putAssets, deleteAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(deleteAssets).toContain(IDS.P1);
      expect(putAssets).toBeDefined();
      expect(putAssets!.length).toBeGreaterThan(0);

      const addedPipe = putAssets!.find(
        (asset) => asset.type === "pipe",
      ) as Pipe;
      expect(addedPipe).toBeDefined();
      expect(addedPipe.connections).toEqual([IDS.J1, IDS.J2]);
      expect(addedPipe.isActive).toBe(true);
    });

    it("throws error for mismatched link types", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
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
        .build();

      const newPump = hydraulicModel.assetBuilder.buildPump({
        label: "PU1",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      expect(() =>
        replaceLink(hydraulicModel, {
          sourceLinkId: IDS.P1,
          newLink: newPump,
          startNode,
          endNode,
        }),
      ).toThrow("Link types must match");
    });

    it("handles pipe splitting when startPipeId and endPipeId provided", () => {
      const IDS = { J1: 1, J2: 2, P1: 3 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [5, 0],
            [10, 0],
          ],
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [2, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [8, 0],
      });

      const { putAssets, deleteAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
        startPipeId: IDS.P1,
        endPipeId: IDS.P1,
      });

      expect(deleteAssets).toContain(IDS.P1);
      expect(putAssets).toBeDefined();
      expect(putAssets!.length).toBeGreaterThan(1); // Should include split pipes + new pipe + nodes
    });
  });

  describe("active topology status inheritance", () => {
    it("inherits isActive from source link when replacing active link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;
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
          isActive: true,
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        id: IDS.P2,
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putAssets).toHaveLength(3);
      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );
      expect(assetsActiveTopologyState[IDS.P2]).toBe(true);
      expect(assetsActiveTopologyState[IDS.J1]).toBe(true);
      expect(assetsActiveTopologyState[IDS.J2]).toBe(true);
    });

    it("inherits isActive from source link when replacing inactive link", () => {
      const IDS = { J1: 1, J2: 2, P0: 3, P1: 4, P2: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        id: IDS.P2,
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putAssets).toHaveLength(3);
      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );
      expect(assetsActiveTopologyState[IDS.P2]).toBe(false);
      expect(assetsActiveTopologyState[IDS.J1]).toBe(false);
      expect(assetsActiveTopologyState[IDS.J2]).toBe(false);
    });

    it("re-activates old nodes when removing only non-active link", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, J3: 4, J4: 5, P2: 6 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        id: IDS.P2,
        label: "P2",
        coordinates: [
          [2, 0],
          [8, 0],
        ],
      });
      const newStartNode = hydraulicModel.assetBuilder.buildJunction({
        id: IDS.J3,
        coordinates: [2, 0],
      });
      const newEndNode = hydraulicModel.assetBuilder.buildJunction({
        id: IDS.J4,
        coordinates: [8, 0],
      });

      const { putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode: newStartNode,
        endNode: newEndNode,
      });

      expect(putAssets).toHaveLength(5);
      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );
      expect(assetsActiveTopologyState[IDS.J1]).toBe(true);
      expect(assetsActiveTopologyState[IDS.J2]).toBe(true);
      expect(assetsActiveTopologyState[IDS.J3]).toBe(false);
      expect(assetsActiveTopologyState[IDS.J4]).toBe(false);
    });

    it("deactivates previous nodes when removing only active link", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P0: 5, P1: 6, P2: 7 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: true })
        .aPipe(IDS.P0, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: false,
        })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          isActive: true,
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        id: IDS.P2,
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const newStartNode = hydraulicModel.assetBuilder.buildJunction({
        id: IDS.J3,
        coordinates: [2, 0],
      });

      const newEndNode = hydraulicModel.assetBuilder.buildJunction({
        id: IDS.J4,
        coordinates: [8, 0],
      });

      const { putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode: newStartNode,
        endNode: newEndNode,
      });

      expect(putAssets).toHaveLength(5);
      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );
      expect(assetsActiveTopologyState[IDS.J1]).toBe(false);
      expect(assetsActiveTopologyState[IDS.J2]).toBe(false);
    });

    it("sets correct active state for nodes when redrawing inactive pipe splitting inactive and active pipes", () => {
      const IDS = {
        J1: 1,
        J2: 2,
        J3: 3,
        J4: 4,
        P1: 5,
        P2: 6,
        P3: 7,
        P1_Redrawn: 8,
        N1: 9,
        N2: 10,
      } as const;

      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
        .aJunction(IDS.J2, { coordinates: [10, 0], isActive: false })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          isActive: false,
        })
        .aJunction(IDS.J3, { coordinates: [0, 10], isActive: false })
        .aJunction(IDS.J4, { coordinates: [10, 10], isActive: false })
        .aPipe(IDS.P2, {
          startNodeId: IDS.J3,
          endNodeId: IDS.J4,
          coordinates: [
            [0, 10],
            [10, 10],
          ],
          isActive: false,
        })
        .aJunction(IDS.J3 + 10, { coordinates: [0, 20], isActive: true })
        .aJunction(IDS.J4 + 10, { coordinates: [10, 20], isActive: true })
        .aPipe(IDS.P3, {
          startNodeId: IDS.J3 + 10,
          endNodeId: IDS.J4 + 10,
          coordinates: [
            [0, 20],
            [10, 20],
          ],
          isActive: true,
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        id: IDS.P1_Redrawn,
        label: "P1_Redrawn",
        coordinates: [
          [5, 10], // Will split P2
          [5, 20], // Will split P3
        ],
      });

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        id: IDS.N1,
        label: "N1",
        coordinates: [5, 10],
      });

      const endNode = hydraulicModel.assetBuilder.buildJunction({
        id: IDS.N2,
        label: "N2",
        coordinates: [5, 20],
      });

      const { putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
        startPipeId: IDS.P2,
        endPipeId: IDS.P3,
      });

      expect(putAssets).toBeDefined();

      const assetsActiveTopologyState = Object.fromEntries(
        putAssets!.map((asset) => [asset.id, asset.isActive]),
      );

      expect(assetsActiveTopologyState[IDS.P1_Redrawn]).toBe(false);
      expect(assetsActiveTopologyState[IDS.N1]).toBe(false);
      expect(assetsActiveTopologyState[IDS.N2]).toBe(true);
    });
  });

  describe("customer points reconnection", () => {
    it("reconnects customer points to closest junction", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, CP1: 5 } as const;
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
          coordinates: [2, 1],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [2, 0],
            junctionId: IDS.J1,
          },
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });
      newPipe.setProperty("id", IDS.P2);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putCustomerPoints, putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toBe(1);

      const reconnectedCP = putCustomerPoints![0];
      expect(reconnectedCP.id).toBe(IDS.CP1);
      expect(reconnectedCP.connection).not.toBeNull();
      expect(reconnectedCP.connection!.junctionId).toBe(IDS.J1);

      const newPipeId = putAssets!.find((asset) => asset.type === "pipe")!.id;
      expect(reconnectedCP.connection!.pipeId).toBe(newPipeId);

      expect(reconnectedCP.connection!.snapPoint).toEqual([2, 0]);
    });

    it("recalculates snap point when new pipe has different geometry", () => {
      const IDS = { J1: 1, J2: 2, P1: 3, P2: 4, CP1: 5 } as const;
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
          coordinates: [3, 2],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [3, 0],
            junctionId: IDS.J1,
          },
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [5, 5],
          [10, 0],
        ],
      });
      newPipe.setProperty("id", IDS.P2);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putCustomerPoints } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      const reconnectedCP = putCustomerPoints![0];

      expect(reconnectedCP.connection!.snapPoint).not.toEqual([3, 0]);

      const snapPoint = reconnectedCP.connection!.snapPoint;
      expect(snapPoint[0]).toBeCloseTo(2.5, 1);
      expect(snapPoint[1]).toBeCloseTo(2.5, 1);
    });

    it("reconnects to farther junction when closer is not junction", () => {
      const IDS = { T1: 1, J2: 2, P1: 3, P2: 4, CP1: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank(IDS.T1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.T1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [2, 1],
          connection: {
            pipeId: IDS.P1,
            snapPoint: [2, 0],
            junctionId: IDS.J2,
          },
        })
        .build();

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });
      newPipe.setProperty("id", IDS.P2);

      const startNode = hydraulicModel.assets.get(IDS.T1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putCustomerPoints } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      const reconnectedCP = putCustomerPoints![0];
      expect(reconnectedCP.connection!.junctionId).toBe(IDS.J2);
    });

    it("disconnects customer points when no junctions available", () => {
      const IDS = { T1: 1, R1: 2, P1: 3, P2: 4, CP1: 5 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank(IDS.T1, { coordinates: [0, 0] })
        .aReservoir(IDS.R1, { coordinates: [10, 0] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.T1,
          endNodeId: IDS.R1,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const customerPoint = CustomerPoint.build(IDS.CP1, [5, 1], {
        baseDemand: 10,
        label: "CP1",
      });
      customerPoint.connect({
        pipeId: IDS.P1,
        snapPoint: [5, 0],
        junctionId: IDS.T1,
      });
      hydraulicModel.customerPoints.set(IDS.CP1, customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });
      newPipe.setProperty("id", IDS.P2);

      const startNode = hydraulicModel.assets.get(IDS.T1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.R1) as NodeAsset;

      const { putCustomerPoints } = replaceLink(hydraulicModel, {
        sourceLinkId: IDS.P1,
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      const disconnectedCP = putCustomerPoints![0];
      expect(disconnectedCP.connection).toBeNull();
    });

    it("handles non-pipe links without customer point processing", () => {
      const IDS = { J1: 1, J2: 2, PU1: 3, PU2: 4 } as const;
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPump(IDS.PU1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J2,
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const newPump = hydraulicModel.assetBuilder.buildPump({
        label: "PU2",
        coordinates: [
          [0, 0],
          [5, 0],
          [10, 0],
        ],
      });
      newPump.setProperty("id", IDS.PU2);

      const startNode = hydraulicModel.assets.get(IDS.J1) as NodeAsset;
      const endNode = hydraulicModel.assets.get(IDS.J2) as NodeAsset;

      const { putAssets, deleteAssets, putCustomerPoints } = replaceLink(
        hydraulicModel,
        {
          sourceLinkId: IDS.PU1,
          newLink: newPump,
          startNode,
          endNode,
        },
      );

      expect(deleteAssets).toContain(IDS.PU1);
      expect(putAssets).toBeDefined();
      expect(putCustomerPoints).toBeUndefined();
    });
  });

  describe("error cases", () => {
    it("throws error when source link not found", () => {
      const IDS = { NONEXISTENT: 999 } as const;
      const hydraulicModel = HydraulicModelBuilder.with().build();
      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });

      const startNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [0, 0],
      });
      const endNode = hydraulicModel.assetBuilder.buildJunction({
        coordinates: [10, 0],
      });

      expect(() =>
        replaceLink(hydraulicModel, {
          sourceLinkId: IDS.NONEXISTENT,
          newLink: newPipe,
          startNode,
          endNode,
        }),
      ).toThrow(`Source link with id ${IDS.NONEXISTENT} not found`);
    });
  });
});
