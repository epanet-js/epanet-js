import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { mergeNodes } from "./merge-nodes";
import { NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";
import { Junction } from "src/hydraulic-model/asset-types/junction";

describe("mergeNodes", () => {
  it("merges J1 into J2 position with J1 surviving", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        coordinates: [10, 20],
        elevation: 100,
        baseDemand: 50,
      })
      .aJunction(IDS.J2, {
        coordinates: [30, 40],
        elevation: 150,
        baseDemand: 30,
      })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    expect(moment.note).toBe("Merge junction into junction");
    expect(moment.deleteAssets).toEqual([IDS.J2]);
    expect(moment.putAssets).toHaveLength(2);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.J1);
    expect(survivingNode.type).toBe("junction");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
    expect((survivingNode as Junction).baseDemand).toBe(80);

    const updatedPipe = moment.putAssets![1] as LinkAsset;
    expect(updatedPipe.id).toBe(IDS.P1);
    expect(updatedPipe.connections[0]).toBe(IDS.J1);
    expect(updatedPipe.connections[1]).toBe(IDS.J3);
    expect(updatedPipe.coordinates[0]).toEqual([30, 40]);
  });

  it("merges junction into tank with tank surviving due to priority", () => {
    const IDS = { J1: 1, T1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.T1,
    });

    expect(moment.note).toBe("Merge junction into tank");
    expect(moment.deleteAssets).toEqual([IDS.J1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges tank into junction with tank surviving due to priority", () => {
    const IDS = { T1: 1, J1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.T1,
      targetNodeId: IDS.J1,
    });

    expect(moment.note).toBe("Merge junction into tank");
    expect(moment.deleteAssets).toEqual([IDS.J1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges nodes with multiple connections from both nodes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aJunction(IDS.J4, { coordinates: [70, 80] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J4 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    expect(moment.deleteAssets).toEqual([IDS.J2]);
    expect(moment.putAssets).toHaveLength(3);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.J1);
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe1 = moment.putAssets!.find(
      (asset) => asset.id === IDS.P1,
    ) as LinkAsset;
    expect(updatedPipe1.connections[0]).toBe(IDS.J1);
    expect(updatedPipe1.connections[1]).toBe(IDS.J3);
    expect(updatedPipe1.coordinates[0]).toEqual([30, 40]);

    const updatedPipe2 = moment.putAssets!.find(
      (asset) => asset.id === IDS.P2,
    ) as LinkAsset;
    expect(updatedPipe2.connections[0]).toBe(IDS.J1);
    expect(updatedPipe2.connections[1]).toBe(IDS.J4);
  });

  it("preserves parallel links when merging nodes with shared connections", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    expect(moment.putAssets).toHaveLength(3);

    const pipe1 = moment.putAssets!.find((asset) => asset.id === IDS.P1);
    const pipe2 = moment.putAssets!.find((asset) => asset.id === IDS.P2);

    expect(pipe1).toBeDefined();
    expect(pipe2).toBeDefined();

    expect((pipe1 as LinkAsset).connections).toContain(IDS.J1);
    expect((pipe2 as LinkAsset).connections).toContain(IDS.J1);
  });

  it("merges nodes with no connections", () => {
    const IDS = { J1: 1, J2: 2 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    expect(moment.deleteAssets).toEqual([IDS.J2]);
    expect(moment.putAssets).toHaveLength(1);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.J1);
    expect(survivingNode.coordinates).toEqual([30, 40]);
  });

  it("merges reservoir into tank with source winning (same priority, default rule)", () => {
    const IDS = { R1: 1, T1: 2, J1: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J1, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.R1,
      targetNodeId: IDS.T1,
    });

    expect(moment.note).toBe("Merge tank into reservoir");
    expect(moment.deleteAssets).toEqual([IDS.T1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
  });

  it("merges reservoir into junction with reservoir surviving due to priority", () => {
    const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J2 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.R1,
      targetNodeId: IDS.J1,
    });

    expect(moment.note).toBe("Merge junction into reservoir");
    expect(moment.deleteAssets).toEqual([IDS.J1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges junction into reservoir with reservoir surviving due to priority", () => {
    const IDS = { J1: 1, R1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aReservoir(IDS.R1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.R1,
    });

    expect(moment.note).toBe("Merge junction into reservoir");
    expect(moment.deleteAssets).toEqual([IDS.J1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges tank into tank with source winning (same type, default rule)", () => {
    const IDS = { T1: 1, T2: 2, J1: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T2, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J1, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.T1,
      targetNodeId: IDS.T2,
    });

    expect(moment.note).toBe("Merge tank into tank");
    expect(moment.deleteAssets).toEqual([IDS.T2]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges reservoir into reservoir with source winning (same type, default rule)", () => {
    const IDS = { R1: 1, R2: 2, J1: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aReservoir(IDS.R1, { coordinates: [10, 20], elevation: 100 })
      .aReservoir(IDS.R2, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J1, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.R1,
      targetNodeId: IDS.R2,
    });

    expect(moment.note).toBe("Merge reservoir into reservoir");
    expect(moment.deleteAssets).toEqual([IDS.R2]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("updates loser link coordinates when junction merges into reservoir", () => {
    const IDS = { J1: 1, R1: 2, J2: 3, J3: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aReservoir(IDS.R1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aJunction(IDS.J3, { coordinates: [70, 80] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.R1,
    });

    expect(moment.deleteAssets).toEqual([IDS.J1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe1 = moment.putAssets!.find(
      (asset) => asset.id === IDS.P1,
    ) as LinkAsset;
    expect(updatedPipe1.connections[0]).toBe(IDS.R1);
    expect(updatedPipe1.connections[1]).toBe(IDS.J2);
    expect(updatedPipe1.coordinates[0]).toEqual([30, 40]);
    expect(updatedPipe1.coordinates[1]).toEqual([50, 60]);

    const updatedPipe2 = moment.putAssets!.find(
      (asset) => asset.id === IDS.P2,
    ) as LinkAsset;
    expect(updatedPipe2.connections[0]).toBe(IDS.J3);
    expect(updatedPipe2.connections[1]).toBe(IDS.R1);
    expect(updatedPipe2.coordinates[0]).toEqual([70, 80]);
    expect(updatedPipe2.coordinates[1]).toEqual([30, 40]);
  });

  it("updates loser link coordinates when junction merges into tank", () => {
    const IDS = { J1: 1, T1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.T1,
    });

    expect(moment.deleteAssets).toEqual([IDS.J1]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.T1);
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe = moment.putAssets!.find(
      (asset) => asset.id === IDS.P1,
    ) as LinkAsset;
    expect(updatedPipe.connections[0]).toBe(IDS.T1);
    expect(updatedPipe.connections[1]).toBe(IDS.J2);
    expect(updatedPipe.coordinates[0]).toEqual([30, 40]);
    expect(updatedPipe.coordinates[1]).toEqual([50, 60]);
  });

  it("throws error for invalid source node ID", () => {
    const IDS = { J1: 1 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .build();

    expect(() => {
      mergeNodes(model, {
        sourceNodeId: 999,
        targetNodeId: IDS.J1,
      });
    }).toThrow("Invalid source node ID: 999");
  });

  it("throws error for invalid target node ID", () => {
    const IDS = { J1: 1 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .build();

    expect(() => {
      mergeNodes(model, {
        sourceNodeId: IDS.J1,
        targetNodeId: 999,
      });
    }).toThrow("Invalid target node ID: 999");
  });

  it("updates coordinates of pipes connected to source node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 100] })
      .aJunction(IDS.J3, { coordinates: [200, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    const updatedPipe = moment.putAssets!.find(
      (asset) => asset.id === IDS.P1,
    ) as LinkAsset;
    expect(updatedPipe.coordinates[0]).toEqual([100, 100]);
    expect(updatedPipe.coordinates[updatedPipe.coordinates.length - 1]).toEqual(
      [200, 0],
    );
  });

  it("handles node with connections at both ends of pipe", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aJunction(IDS.J4, { coordinates: [70, 80] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J4, endNodeId: IDS.J2 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    const pipe1 = moment.putAssets!.find((a) => a.id === IDS.P1) as LinkAsset;
    const pipe2 = moment.putAssets!.find((a) => a.id === IDS.P2) as LinkAsset;

    expect(pipe1.connections[0]).toBe(IDS.J1);
    expect(pipe1.coordinates[0]).toEqual([30, 40]);

    expect(pipe2.connections[1]).toBe(IDS.J1);
  });

  it("aggregates baseDemand when merging two junctions with demands", () => {
    const IDS = { J1: 1, J2: 2 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        coordinates: [10, 20],
        elevation: 100,
        baseDemand: 75,
      })
      .aJunction(IDS.J2, {
        coordinates: [30, 40],
        elevation: 150,
        baseDemand: 25,
      })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.J2,
    });

    const survivingJunction = moment.putAssets![0] as Junction;
    expect(survivingJunction.id).toBe(IDS.J1);
    expect(survivingJunction.type).toBe("junction");
    expect(survivingJunction.baseDemand).toBe(100);
  });

  it("does not aggregate demand when merging junction into tank", () => {
    const IDS = { J1: 1, T1: 2 };
    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, {
        coordinates: [10, 20],
        elevation: 100,
        baseDemand: 50,
      })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.J1,
      targetNodeId: IDS.T1,
    });

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect((survivingNode as any).baseDemand).toBeUndefined();
  });

  it("does not aggregate demand when merging tank into junction", () => {
    const IDS = { T1: 1, J1: 2 };
    const model = HydraulicModelBuilder.with()
      .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J1, {
        coordinates: [30, 40],
        elevation: 150,
        baseDemand: 60,
      })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: IDS.T1,
      targetNodeId: IDS.J1,
    });

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe(IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect((survivingNode as any).baseDemand).toBeUndefined();
  });
});
