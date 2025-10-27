import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { replaceNode } from "./replace-node";
import { NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";

describe("replaceNode", () => {
  it("replaces junction with tank and preserves connections", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20], elevation: 100 })
      .aJunction("J2", { coordinates: [30, 40] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "J1",
      newNodeType: "tank",
    });

    expect(moment.note).toBe("Replace junction with tank");
    expect(moment.deleteAssets).toEqual(["J1"]);
    expect(moment.putAssets).toHaveLength(2);

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.type).toBe("tank");
    expect(newNode.coordinates).toEqual([10, 20]);
    expect(newNode.elevation).toBe(100);
    expect(newNode.label).not.toBe("");

    const updatedPipe = moment.putAssets![1] as LinkAsset;
    expect(updatedPipe.type).toBe("pipe");
    expect(updatedPipe.connections[0]).toBe(newNode.id);
    expect(updatedPipe.connections[1]).toBe("J2");
  });

  it("replaces reservoir with junction and preserves connections", () => {
    const model = HydraulicModelBuilder.with()
      .aReservoir("R1", { coordinates: [5, 5], elevation: 50 })
      .aJunction("J1", { coordinates: [15, 15] })
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "R1",
      newNodeType: "junction",
    });

    expect(moment.note).toBe("Replace reservoir with junction");
    expect(moment.deleteAssets).toEqual(["R1"]);

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.type).toBe("junction");
    expect(newNode.coordinates).toEqual([5, 5]);
    expect(newNode.elevation).toBe(50);

    const updatedPipe = moment.putAssets![1] as LinkAsset;
    expect(updatedPipe.connections[0]).toBe(newNode.id);
    expect(updatedPipe.connections[1]).toBe("J1");
  });

  it("replaces tank with reservoir and preserves multiple connections", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [0, 0], elevation: 25 })
      .aJunction("J1", { coordinates: [10, 0] })
      .aJunction("J2", { coordinates: [0, 10] })
      .aJunction("J3", { coordinates: [-10, 0] })
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J1" })
      .aPipe("P2", { startNodeId: "T1", endNodeId: "J2" })
      .aPipe("P3", { startNodeId: "J3", endNodeId: "T1" })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "T1",
      newNodeType: "reservoir",
    });

    expect(moment.note).toBe("Replace tank with reservoir");
    expect(moment.deleteAssets).toEqual(["T1"]);
    expect(moment.putAssets).toHaveLength(4);

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.type).toBe("reservoir");
    expect(newNode.coordinates).toEqual([0, 0]);

    const updatedPipes = moment.putAssets!.slice(1) as LinkAsset[];
    expect(updatedPipes).toHaveLength(3);

    const p1 = updatedPipes.find((p) => p.connections[1] === "J1");
    expect(p1?.connections[0]).toBe(newNode.id);

    const p2 = updatedPipes.find((p) => p.connections[1] === "J2");
    expect(p2?.connections[0]).toBe(newNode.id);

    const p3 = updatedPipes.find((p) => p.connections[0] === "J3");
    expect(p3?.connections[1]).toBe(newNode.id);
  });

  it("generates new auto-label for replaced node", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [5, 5] })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "J1",
      newNodeType: "tank",
    });

    const newNode = moment.putAssets![0];
    expect(newNode.label).toMatch(/^T\d+$/);
    expect(newNode.label).not.toBe("J1");
  });

  it("uses default properties for new node type", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [1, 1], elevation: 10, baseDemand: 50 })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "J1",
      newNodeType: "tank",
    });

    const newTank = moment.putAssets![0];
    expect(newTank.type).toBe("tank");
    expect(newTank.hasProperty("baseDemand")).toBe(false);
    expect(newTank.hasProperty("diameter")).toBe(true);
  });

  it("handles node with no connections", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "J1",
      newNodeType: "reservoir",
    });

    expect(moment.note).toBe("Replace junction with reservoir");
    expect(moment.deleteAssets).toEqual(["J1"]);
    expect(moment.putAssets).toHaveLength(1);

    const newNode = moment.putAssets![0];
    expect(newNode.type).toBe("reservoir");
  });

  it("throws error for invalid node ID", () => {
    const model = HydraulicModelBuilder.empty();

    expect(() =>
      replaceNode(model, {
        oldNodeId: "INVALID",
        newNodeType: "junction",
      }),
    ).toThrow("Invalid node ID: INVALID");
  });

  it("throws error when trying to replace a link", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 10] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    expect(() =>
      replaceNode(model, {
        oldNodeId: "P1",
        newNodeType: "junction",
      }),
    ).toThrow("Invalid node ID: P1");
  });

  it("handles customer points connected to pipes", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [10, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aCustomerPoint("CP1", {
        demand: 25,
        coordinates: [2, 0],
        connection: { pipeId: "P1", snapPoint: [2, 0], junctionId: "J1" },
      })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: "J1",
      newNodeType: "tank",
    });

    expect(moment.putCustomerPoints).toBeDefined();
    expect(moment.putCustomerPoints?.length).toBeGreaterThan(0);

    const reconnectedCP = moment.putCustomerPoints![0];
    expect(reconnectedCP.connection).not.toBeNull();
    expect(reconnectedCP.connection?.pipeId).toBe("P1");
  });
});
