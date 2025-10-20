import { describe, it, expect } from "vitest";
import { replaceLink } from "./replace-link";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Pipe, NodeAsset } from "../asset-types";
import { CustomerPoint } from "../customer-points";

describe("replaceLink", () => {
  describe("basic functionality", () => {
    it("replaces existing pipe with new pipe", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          diameter: 200,
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
      newPipe.setProperty("id", "P2");

      const startNode = hydraulicModel.assets.get("J1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("J2") as NodeAsset;

      const { putAssets, deleteAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: "P1",
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(deleteAssets).toContain("P1");
      expect(putAssets).toBeDefined();
      expect(putAssets!.length).toBeGreaterThan(0);

      const addedPipe = putAssets!.find(
        (asset) => asset.type === "pipe",
      ) as Pipe;
      expect(addedPipe).toBeDefined();
      expect(addedPipe.connections).toEqual(["J1", "J2"]);
    });

    it("throws error for mismatched link types", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
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

      const startNode = hydraulicModel.assets.get("J1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("J2") as NodeAsset;

      expect(() =>
        replaceLink(hydraulicModel, {
          sourceLinkId: "P1",
          newLink: newPump,
          startNode,
          endNode,
        }),
      ).toThrow("Link types must match");
    });

    it("handles pipe splitting when startPipeId and endPipeId provided", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
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
        sourceLinkId: "P1",
        newLink: newPipe,
        startNode,
        endNode,
        startPipeId: "P1",
        endPipeId: "P1",
      });

      expect(deleteAssets).toContain("P1");
      expect(putAssets).toBeDefined();
      expect(putAssets!.length).toBeGreaterThan(1); // Should include split pipes + new pipe + nodes
    });
  });

  describe("customer points reconnection", () => {
    it("reconnects customer points to closest junction", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint("CP1", {
          coordinates: [2, 1],
          connection: {
            pipeId: "P1",
            snapPoint: [2, 0],
            junctionId: "J1",
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
      newPipe.setProperty("id", "P2");

      const startNode = hydraulicModel.assets.get("J1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("J2") as NodeAsset;

      const { putCustomerPoints, putAssets } = replaceLink(hydraulicModel, {
        sourceLinkId: "P1",
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toBe(1);

      const reconnectedCP = putCustomerPoints![0];
      expect(reconnectedCP.id).toBe("CP1");
      expect(reconnectedCP.connection).not.toBeNull();
      expect(reconnectedCP.connection!.junctionId).toBe("J1");

      const newPipeId = putAssets!.find((asset) => asset.type === "pipe")!.id;
      expect(reconnectedCP.connection!.pipeId).toBe(newPipeId);

      expect(reconnectedCP.connection!.snapPoint).toEqual([2, 0]);
    });

    it("recalculates snap point when new pipe has different geometry", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "J1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint("CP1", {
          coordinates: [3, 2],
          connection: {
            pipeId: "P1",
            snapPoint: [3, 0],
            junctionId: "J1",
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
      newPipe.setProperty("id", "P2");

      const startNode = hydraulicModel.assets.get("J1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("J2") as NodeAsset;

      const { putCustomerPoints } = replaceLink(hydraulicModel, {
        sourceLinkId: "P1",
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
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank("T1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "T1",
          endNodeId: "J2",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .aCustomerPoint("CP1", {
          coordinates: [2, 1],
          connection: {
            pipeId: "P1",
            snapPoint: [2, 0],
            junctionId: "J2",
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
      newPipe.setProperty("id", "P2");

      const startNode = hydraulicModel.assets.get("T1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("J2") as NodeAsset;

      const { putCustomerPoints } = replaceLink(hydraulicModel, {
        sourceLinkId: "P1",
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      const reconnectedCP = putCustomerPoints![0];
      expect(reconnectedCP.connection!.junctionId).toBe("J2");
    });

    it("disconnects customer points when no junctions available", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aTank("T1", { coordinates: [0, 0] })
        .aReservoir("R1", { coordinates: [10, 0] })
        .aPipe("P1", {
          startNodeId: "T1",
          endNodeId: "R1",
          coordinates: [
            [0, 0],
            [10, 0],
          ],
        })
        .build();

      const customerPoint = CustomerPoint.build("CP1", [5, 1], {
        baseDemand: 10,
        label: "CP1",
      });
      customerPoint.connect({
        pipeId: "P1",
        snapPoint: [5, 0],
        junctionId: "T1",
      });
      hydraulicModel.customerPoints.set("CP1", customerPoint);
      hydraulicModel.customerPointsLookup.addConnection(customerPoint);

      const newPipe = hydraulicModel.assetBuilder.buildPipe({
        label: "P2",
        coordinates: [
          [0, 0],
          [10, 0],
        ],
      });
      newPipe.setProperty("id", "P2");

      const startNode = hydraulicModel.assets.get("T1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("R1") as NodeAsset;

      const { putCustomerPoints } = replaceLink(hydraulicModel, {
        sourceLinkId: "P1",
        newLink: newPipe,
        startNode,
        endNode,
      });

      expect(putCustomerPoints).toBeDefined();
      const disconnectedCP = putCustomerPoints![0];
      expect(disconnectedCP.connection).toBeNull();
    });

    it("handles non-pipe links without customer point processing", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [10, 0] })
        .aPump("PU1", {
          startNodeId: "J1",
          endNodeId: "J2",
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
      newPump.setProperty("id", "PU2");

      const startNode = hydraulicModel.assets.get("J1") as NodeAsset;
      const endNode = hydraulicModel.assets.get("J2") as NodeAsset;

      const { putAssets, deleteAssets, putCustomerPoints } = replaceLink(
        hydraulicModel,
        {
          sourceLinkId: "PU1",
          newLink: newPump,
          startNode,
          endNode,
        },
      );

      expect(deleteAssets).toContain("PU1");
      expect(putAssets).toBeDefined();
      expect(putCustomerPoints).toBeUndefined();
    });
  });

  describe("error cases", () => {
    it("throws error when source link not found", () => {
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
          sourceLinkId: "NONEXISTENT",
          newLink: newPipe,
          startNode,
          endNode,
        }),
      ).toThrow("Source link with id NONEXISTENT not found");
    });
  });
});
