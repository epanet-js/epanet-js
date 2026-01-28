import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { replaceNode } from "./replace-node";
import { NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";

describe("replaceNode", () => {
  it("replaces junction with tank and preserves connections", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "tank",
    });

    expect(moment.note).toBe("Replace junction with tank");
    expect(moment.deleteAssets).toEqual([IDS.J1]);
    expect(moment.putAssets).toHaveLength(2);

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.type).toBe("tank");
    expect(newNode.coordinates).toEqual([10, 20]);
    expect(newNode.elevation).toBe(100);
    expect(newNode.label).not.toBe("");

    const updatedPipe = moment.putAssets![1] as LinkAsset;
    expect(updatedPipe.type).toBe("pipe");
    expect(updatedPipe.connections[0]).toBe(newNode.id);
    expect(updatedPipe.connections[1]).toBe(IDS.J2);
  });

  it("replaces reservoir with junction and preserves connections", () => {
    const IDS = { R1: 1, J1: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { coordinates: [5, 5], elevation: 50 })
      .aJunction(IDS.J1, { coordinates: [15, 15] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.R1,
      newNodeType: "junction",
    });

    expect(moment.note).toBe("Replace reservoir with junction");
    expect(moment.deleteAssets).toEqual([IDS.R1]);

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.type).toBe("junction");
    expect(newNode.coordinates).toEqual([5, 5]);
    expect(newNode.elevation).toBe(50);

    const updatedPipe = moment.putAssets![1] as LinkAsset;
    expect(updatedPipe.connections[0]).toBe(newNode.id);
    expect(updatedPipe.connections[1]).toBe(IDS.J1);
  });

  it("replaces tank with reservoir and preserves multiple connections", () => {
    const IDS = { T1: 1, J1: 2, J2: 3, J3: 4, P1: 5, P2: 6, P3: 7 } as const;
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1, { coordinates: [0, 0], elevation: 25 })
      .aJunction(IDS.J1, { coordinates: [10, 0] })
      .aJunction(IDS.J2, { coordinates: [0, 10] })
      .aJunction(IDS.J3, { coordinates: [-10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .aPipe(IDS.P2, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
      .aPipe(IDS.P3, { startNodeId: IDS.J3, endNodeId: IDS.T1 })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.T1,
      newNodeType: "reservoir",
    });

    expect(moment.note).toBe("Replace tank with reservoir");
    expect(moment.deleteAssets).toEqual([IDS.T1]);
    expect(moment.putAssets).toHaveLength(4);

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.type).toBe("reservoir");
    expect(newNode.coordinates).toEqual([0, 0]);

    const updatedPipes = moment.putAssets!.slice(1) as LinkAsset[];
    expect(updatedPipes).toHaveLength(3);

    const p1 = updatedPipes.find((p) => p.connections[1] === IDS.J1);
    expect(p1?.connections[0]).toBe(newNode.id);

    const p2 = updatedPipes.find((p) => p.connections[1] === IDS.J2);
    expect(p2?.connections[0]).toBe(newNode.id);

    const p3 = updatedPipes.find((p) => p.connections[0] === IDS.J3);
    expect(p3?.connections[1]).toBe(newNode.id);
  });

  it("generates new auto-label for replaced node", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [5, 5] })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "tank",
    });

    const newNode = moment.putAssets![0];
    expect(newNode.label).toMatch(/^T\d+$/);
    expect(newNode.label).not.toBe("J1");
  });

  it("uses default properties for new node type", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        coordinates: [1, 1],
        elevation: 10,
        demands: [{ baseDemand: 50 }],
      })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "tank",
    });

    const newTank = moment.putAssets![0];
    expect(newTank.type).toBe("tank");
    expect(newTank.hasProperty("baseDemand")).toBe(false);
    expect(newTank.hasProperty("diameter")).toBe(true);
  });

  it("handles node with no connections", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "reservoir",
    });

    expect(moment.note).toBe("Replace junction with reservoir");
    expect(moment.deleteAssets).toEqual([IDS.J1]);
    expect(moment.putAssets).toHaveLength(1);

    const newNode = moment.putAssets![0];
    expect(newNode.type).toBe("reservoir");
  });

  it("throws error for invalid node ID", () => {
    const model = HydraulicModelBuilder.empty();
    const invalidNodeId = 1;

    expect(() =>
      replaceNode(model, {
        oldNodeId: invalidNodeId,
        newNodeType: "junction",
      }),
    ).toThrow("Invalid node ID: 1");
  });

  it("throws error when trying to replace a link", () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 10] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    expect(() =>
      replaceNode(model, {
        oldNodeId: IDS.P1,
        newNodeType: "junction",
      }),
    ).toThrow(`Invalid node ID: ${IDS.P1}`);
  });

  it("handles customer points connected to pipes", () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 4 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [10, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aCustomerPoint(IDS.CP1, {
        demands: [{ baseDemand: 25 }],
        coordinates: [2, 0],
        connection: {
          pipeId: IDS.P1,
          snapPoint: [2, 0],
          junctionId: IDS.J1,
        },
      })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "tank",
    });

    expect(moment.putCustomerPoints).toBeDefined();
    expect(moment.putCustomerPoints?.length).toBeGreaterThan(0);

    const reconnectedCP = moment.putCustomerPoints![0];
    expect(reconnectedCP.connection).not.toBeNull();
    expect(reconnectedCP.connection?.pipeId).toBe(IDS.P1);
  });

  it("preserves isActive when replacing active node", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], isActive: true })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "tank",
    });

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.isActive).toBe(true);
  });

  it("preserves isActive when replacing inactive node", () => {
    const IDS = { J1: 1 } as const;
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0], isActive: false })
      .build();

    const moment = replaceNode(model, {
      oldNodeId: IDS.J1,
      newNodeType: "reservoir",
    });

    const newNode = moment.putAssets![0] as NodeAsset;
    expect(newNode.isActive).toBe(false);
  });
});
