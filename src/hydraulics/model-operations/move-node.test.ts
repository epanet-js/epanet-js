import { describe, expect, it } from "vitest";
import { HydraulicModel } from "../hydraulic-model";
import { Topology } from "../topology";
import { moveNode } from "./move-node";
import {
  LinkAsset,
  NodeAsset,
  createJunction,
  createPipe,
  getLinkCoordinates,
  getNodeCoordinates,
} from "../assets";

describe("moveNode", () => {
  it("updates the coordinates of a node", () => {
    const coordinates = [10, 10];
    const newCoordinates = [20, 20];
    const node = createJunction(coordinates);
    const hydraulicModel: HydraulicModel = {
      assets: new Map(),
      topology: new Topology(),
    };
    hydraulicModel.assets.set(node.id, node);

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: node.id,
      newCoordinates,
    });

    if (!putAssets) throw new Error(`Put assets is empty`);
    const updatedNode = putAssets[0] as NodeAsset;
    expect(updatedNode.id).toEqual(node.id);
    expect(getNodeCoordinates(updatedNode)).toEqual([20, 20]);
  });

  it("updates the connected links", () => {
    const nodeA = createJunction([10, 10]);
    const nodeB = createJunction([20, 20]);
    const nodeC = createJunction([30, 30]);
    const pipeAB = createPipe([
      [10, 10],
      [20, 20],
    ]);
    const pipeBC = createPipe([
      [20, 20],
      [30, 30],
    ]);

    const newCoordinates = [25, 25];

    const hydraulicModel: HydraulicModel = {
      assets: new Map(),
      topology: new Topology(),
    };
    hydraulicModel.assets.set(nodeA.id, nodeA);
    hydraulicModel.assets.set(nodeB.id, nodeB);
    hydraulicModel.assets.set(nodeC.id, nodeC);
    hydraulicModel.assets.set(pipeAB.id, pipeAB);
    hydraulicModel.assets.set(pipeBC.id, pipeBC);

    hydraulicModel.topology.addLink(pipeAB.id, nodeA.id, nodeB.id);
    hydraulicModel.topology.addLink(pipeBC.id, nodeB.id, nodeC.id);

    const { putAssets } = moveNode(hydraulicModel, {
      nodeId: nodeB.id,
      newCoordinates,
    });

    if (!putAssets) throw new Error(`Put assets is empty`);

    expect(putAssets.length).toEqual(3);
    const updatedNode = putAssets[0] as NodeAsset;
    expect(updatedNode.id).toEqual(nodeB.id);
    expect(getNodeCoordinates(updatedNode)).toEqual([25, 25]);

    const updatedAB = putAssets[1] as LinkAsset;
    expect(getLinkCoordinates(updatedAB)).toEqual([
      [10, 10],
      [25, 25],
    ]);
    const updatedBC = putAssets[2] as LinkAsset;
    expect(getLinkCoordinates(updatedBC)).toEqual([
      [25, 25],
      [30, 30],
    ]);
  });
});
