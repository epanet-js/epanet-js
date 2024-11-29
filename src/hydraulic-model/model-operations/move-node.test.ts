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
    expect(updatedAB.length).toEqual(2300489.34);

    const updatedBC = putAssets![2] as LinkAsset;
    expect(updatedBC.coordinates).toEqual([newCoordinates, [30, 30]]);
    expect(updatedBC.length).toEqual(742966.22);
  });
});
