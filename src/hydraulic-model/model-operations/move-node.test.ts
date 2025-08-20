import { describe, expect, it } from "vitest";
import { moveNode } from "./move-node";

import { NodeAsset, LinkAsset } from "../asset-types";
import { HydraulicModelBuilder } from "../../__helpers__/hydraulic-model-builder";
import { CustomerPoint } from "../customer-points";
import { Pipe } from "../asset-types/pipe";

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
    expect(updatedAB.length).toBeCloseTo(2300489.34);

    const updatedBC = putAssets![2] as LinkAsset;
    expect(updatedBC.coordinates).toEqual([newCoordinates, [30, 30]]);
    expect(updatedBC.length).toBeCloseTo(742966.22);
  });

  describe("customer points", () => {
    it("updates customer point snap points when updateCustomerPoints is true", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [10, 10])
        .aNode("J2", [30, 10])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      const pipe = Array.from(hydraulicModel.assets.values()).find(
        (asset) => asset.type === "pipe",
      ) as Pipe;
      pipe?.assignCustomerPoint("CP1");

      const customerPoint = new CustomerPoint("CP1", [20, 15], {
        baseDemand: 1,
      });
      customerPoint.connect({
        pipeId: pipe.id,
        snapPoint: [20, 10], // Original snap point
      });
      hydraulicModel.customerPoints.set("CP1", customerPoint);

      const newCoordinates = [10, 20]; // Move J1 up
      const { putAssets, putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates,
        newElevation: 10,
        updateCustomerPoints: true,
      });

      expect(putAssets!.length).toEqual(2); // node + pipe
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
        .build();

      const pipe = Array.from(hydraulicModel.assets.values()).find(
        (asset) => asset.type === "pipe",
      ) as Pipe;
      pipe?.assignCustomerPoint("CP1");

      const customerPoint = new CustomerPoint("CP1", [20, 15], {
        baseDemand: 1,
      });
      customerPoint.connect({
        pipeId: pipe.id,
        snapPoint: [20, 10],
      });
      hydraulicModel.customerPoints.set("CP1", customerPoint);

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [10, 20],
        newElevation: 10,
        updateCustomerPoints: false,
      });

      expect(putCustomerPoints).toBeUndefined();
    });

    it("skips customer points when none are connected to affected pipes", () => {
      const hydraulicModel = HydraulicModelBuilder.with()
        .aNode("J1", [10, 10])
        .aNode("J2", [30, 10])
        .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
        .build();

      // Don't assign any customer points to the pipe

      const { putCustomerPoints } = moveNode(hydraulicModel, {
        nodeId: "J1",
        newCoordinates: [15, 20],
        newElevation: 10,
        updateCustomerPoints: true,
      });

      expect(putCustomerPoints).toBeUndefined();
    });
  });
});
