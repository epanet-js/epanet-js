import { describe, expect, it } from "vitest";
import { moveNode } from "./move-node";

import { NodeAsset, LinkAsset } from "../asset-types";
import { HydraulicModelBuilder } from "../../__helpers__/hydraulic-model-builder";

describe("moveNode", () => {
  it("updates the coordinates of a node", () => {
    const nodeId = "A";
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode(nodeId, [10, 10])
      .build();
    const newCoordinates = [20, 20];
    const newElevation = 10;

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: "A",
      newCoordinates,
      newElevation,
    });

    const updatedNode = putAssets![0] as NodeAsset;
    expect(updatedNode.id).toEqual(nodeId);
    expect(updatedNode.coordinates).toEqual(newCoordinates);
    expect(updatedNode.elevation).toEqual(10);
  });

  it("updates the connected links", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("A", [10, 10])
      .aNode("B", [20, 20])
      .aNode("C", [30, 30])
      .aLink("AB", "A", "B", { length: 1 })
      .aLink("BC", "B", "C", { length: 2 })
      .build();
    const nodeId = "B";
    const newCoordinates = [25, 25];
    const anyElevation = 10;

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId,
      newCoordinates,
      newElevation: anyElevation,
    });

    expect(putAssets!.length).toEqual(3);
    const updatedNode = putAssets![0] as NodeAsset;
    expect(updatedNode.id).toEqual(nodeId);
    expect(updatedNode.coordinates).toEqual(newCoordinates);

    const updatedAB = putAssets![1] as LinkAsset;
    expect(updatedAB.coordinates).toEqual([[10, 10], newCoordinates]);

    const updatedBC = putAssets![2] as LinkAsset;
    expect(updatedBC.coordinates).toEqual([newCoordinates, [30, 30]]);
  });

  describe("customer points", () => {
    it("updates customer point snap points when updateCustomerPoints is true", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [10, 10])
        .aNode("J2", [30, 10])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aCustomerPoint("CP1", {
          coordinates: [20, 15],
          demand: 1,
          connection: {
            pipeId: "P1",
            snapPoint: [20, 10],
            junctionId: "J1",
          },
        })
        .build();

      const newCoordinates = [10, 20];
      const { putAssets, putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates,
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putAssets!.length).toBeGreaterThanOrEqual(2);
      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.id).toEqual("CP1");
      expect(updatedCustomerPoint.connection!.snapPoint).not.toEqual([20, 10]);
    });

    it("does not update customer points when updateCustomerPoints is false", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [10, 10])
        .aNode("J2", [30, 10])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aCustomerPoint("CP1", {
          coordinates: [20, 15],
          demand: 1,
          connection: {
            pipeId: "P1",
            snapPoint: [20, 10],
            junctionId: "J1",
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [10, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: false,
      });

      expect(putCustomerPoints).toBeUndefined();
    });

    it("skips customer points when none are connected to affected pipes", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [10, 10])
        .aNode("J2", [30, 10])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [15, 20],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeUndefined();
    });

    it("reallocates customer point to new junction when node move changes closest endpoint", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [20, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aCustomerPoint("CP1", {
          coordinates: [5, 0],
          demand: 10,
          connection: { pipeId: "P1", junctionId: "J1", snapPoint: [5, 0] },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [25, 0],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.connection!.junctionId).toEqual("J2");
    });

    it("updates junction assignments when customer point stays with same junction", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [20, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aCustomerPoint("CP1", {
          coordinates: [2, 0],
          demand: 10,
          connection: { pipeId: "P1", junctionId: "J1", snapPoint: [2, 0] },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [0, 5],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.connection!.junctionId).toEqual("J1");
      expect(updatedCustomerPoint.connection!.snapPoint).not.toEqual([2, 0]);
    });

    it("handles multiple customer points on same pipe with different junction assignments", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [0, 0] })
        .aJunction("J2", { coordinates: [30, 0] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aCustomerPoint("CP1", {
          coordinates: [5, 0],
          demand: 5,
          connection: { pipeId: "P1", junctionId: "J1", snapPoint: [5, 0] },
        })
        .aCustomerPoint("CP2", {
          coordinates: [25, 0],
          demand: 8,
          connection: { pipeId: "P1", junctionId: "J2", snapPoint: [25, 0] },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [35, 0],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(2);

      const updatedCP1 = putCustomerPoints!.find((cp) => cp.id === "CP1")!;
      const updatedCP2 = putCustomerPoints!.find((cp) => cp.id === "CP2")!;

      expect(updatedCP1.connection!.junctionId).toEqual("J2");
      expect(updatedCP2.connection!.junctionId).toEqual("J2");
    });

    it("assigns customer to correct junction after moving node with updated coordinates", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aJunction("J1", { coordinates: [-122.415, 37.7749] })
        .aJunction("J2", { coordinates: [-122.41, 37.7749] })
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .aCustomerPoint("CP1", {
          coordinates: [-122.414, 37.775],
          demand: 10,
          connection: {
            pipeId: "P1",
            junctionId: "J1",
            snapPoint: [-122.414, 37.7749],
          },
        })
        .build();

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [-122.405, 37.7749],
        newElevation: 10,
        shouldUpdateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeDefined();
      expect(putCustomerPoints!.length).toEqual(1);

      const updatedCustomerPoint = putCustomerPoints![0];
      expect(updatedCustomerPoint.connection!.junctionId).toEqual("J2");
    });
  });

  it("splits pipe and connects moved node when pipeIdToSplit provided", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aNode("J3", [0, 10])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const { putAssets, deleteAssets } = moveNode(hydraulicModel, {
      nodeId: "J3",
      newCoordinates: [5, 0],
      newElevation: 10,
      pipeIdToSplit: "P1",
    });

    expect(deleteAssets).toEqual(["P1"]);
    expect(putAssets).toHaveLength(3);

    const [movedNode, pipe1, pipe2] = putAssets!;
    expect(movedNode.id).toBe("J3");
    expect(movedNode.coordinates).toEqual([5, 0]);

    expect(pipe1.type).toBe("pipe");
    expect(pipe2.type).toBe("pipe");
    expect((pipe1 as any).connections).toEqual(["J1", "J3"]);
    expect((pipe2 as any).connections).toEqual(["J3", "J2"]);
  });

  it("combines move and split operations for customer points", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .aNode("J2", [10, 0])
      .aNode("J3", [0, 10])
      .aNode("J4", [10, 10])
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aPipe("P2", { startNodeId: "J3", endNodeId: "J4" })
      .aCustomerPoint("CP1", {
        coordinates: [3, 1],
        demand: 50,
        connection: {
          pipeId: "P1",
          snapPoint: [3, 0],
          junctionId: "J1",
        },
      })
      .aCustomerPoint("CP2", {
        coordinates: [0, 12],
        demand: 75,
        connection: {
          pipeId: "P2",
          snapPoint: [0, 10],
          junctionId: "J3",
        },
      })
      .build();

    const { putCustomerPoints } = moveNode(hydraulicModel, {
      nodeId: "J3",
      newCoordinates: [5, 0],
      newElevation: 10,
      shouldUpdateCustomerPoints: true,
      pipeIdToSplit: "P1",
    });

    expect(putCustomerPoints).toBeDefined();
    expect(putCustomerPoints!.length).toBeGreaterThan(0);

    const updatedCP1 = putCustomerPoints!.find((cp) => cp.id === "CP1");
    const updatedCP2 = putCustomerPoints!.find((cp) => cp.id === "CP2");

    expect(updatedCP1).toBeDefined();
    expect(updatedCP2).toBeDefined();
  });

  it("throws error for invalid pipeIdToSplit", () => {
    const hydraulicModel = HydraulicModelBuilder.with()
      .aNode("J1", [0, 0])
      .build();

    expect(() =>
      moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: "NonExistentPipe",
      }),
    ).toThrow("Invalid pipe ID: NonExistentPipe");

    expect(() =>
      moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [5, 0],
        newElevation: 10,
        pipeIdToSplit: "J1",
      }),
    ).toThrow("Invalid pipe ID: J1");
  });
});
