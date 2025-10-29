import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { mergeNodes } from "./merge-nodes";
import { NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";

describe("mergeNodes", () => {
  it("merges J1 into J2 position with J1 surviving", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20], elevation: 100 })
      .aJunction("J2", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J3", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J3" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "J2",
    });

    expect(moment.note).toBe("Merge junction into junction");
    expect(moment.deleteAssets).toEqual(["J2"]);
    expect(moment.putAssets).toHaveLength(2);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("J1");
    expect(survivingNode.type).toBe("junction");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(100);

    const updatedPipe = moment.putAssets![1] as LinkAsset;
    expect(updatedPipe.id).toBe("P1");
    expect(updatedPipe.connections[0]).toBe("J1");
    expect(updatedPipe.connections[1]).toBe("J3");
    expect(updatedPipe.coordinates[0]).toEqual([30, 40]);
  });

  it("merges junction into tank with tank surviving due to priority", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20], elevation: 100 })
      .aTank("T1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J2", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "T1",
    });

    expect(moment.note).toBe("Merge junction into tank");
    expect(moment.deleteAssets).toEqual(["J1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("T1");
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges tank into junction with tank surviving due to priority", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [10, 20], elevation: 100 })
      .aJunction("J1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J2", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J2" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "T1",
      targetNodeId: "J1",
    });

    expect(moment.note).toBe("Merge junction into tank");
    expect(moment.deleteAssets).toEqual(["J1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("T1");
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(100);
  });

  it("merges nodes with multiple connections from both nodes", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20] })
      .aJunction("J2", { coordinates: [30, 40] })
      .aJunction("J3", { coordinates: [50, 60] })
      .aJunction("J4", { coordinates: [70, 80] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J3" })
      .aPipe("P2", { startNodeId: "J2", endNodeId: "J4" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "J2",
    });

    expect(moment.deleteAssets).toEqual(["J2"]);
    expect(moment.putAssets).toHaveLength(3);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("J1");
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe1 = moment.putAssets!.find(
      (asset) => asset.id === "P1",
    ) as LinkAsset;
    expect(updatedPipe1.connections[0]).toBe("J1");
    expect(updatedPipe1.connections[1]).toBe("J3");
    expect(updatedPipe1.coordinates[0]).toEqual([30, 40]);

    const updatedPipe2 = moment.putAssets!.find(
      (asset) => asset.id === "P2",
    ) as LinkAsset;
    expect(updatedPipe2.connections[0]).toBe("J1");
    expect(updatedPipe2.connections[1]).toBe("J4");
  });

  it("preserves parallel links when merging nodes with shared connections", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20] })
      .aJunction("J2", { coordinates: [30, 40] })
      .aJunction("J3", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J3" })
      .aPipe("P2", { startNodeId: "J2", endNodeId: "J3" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "J2",
    });

    expect(moment.putAssets).toHaveLength(3);

    const pipe1 = moment.putAssets!.find((asset) => asset.id === "P1");
    const pipe2 = moment.putAssets!.find((asset) => asset.id === "P2");

    expect(pipe1).toBeDefined();
    expect(pipe2).toBeDefined();

    expect((pipe1 as LinkAsset).connections).toContain("J1");
    expect((pipe2 as LinkAsset).connections).toContain("J1");
  });

  it("merges nodes with no connections", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20] })
      .aJunction("J2", { coordinates: [30, 40] })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "J2",
    });

    expect(moment.deleteAssets).toEqual(["J2"]);
    expect(moment.putAssets).toHaveLength(1);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("J1");
    expect(survivingNode.coordinates).toEqual([30, 40]);
  });

  it("merges reservoir into tank with source winning (same priority, default rule)", () => {
    const model = HydraulicModelBuilder.with()
      .aReservoir("R1", { coordinates: [10, 20], elevation: 100 })
      .aTank("T1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J1", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "R1",
      targetNodeId: "T1",
    });

    expect(moment.note).toBe("Merge tank into reservoir");
    expect(moment.deleteAssets).toEqual(["T1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("R1");
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
  });

  it("merges reservoir into junction with reservoir surviving due to priority", () => {
    const model = HydraulicModelBuilder.with()
      .aReservoir("R1", { coordinates: [10, 20], elevation: 100 })
      .aJunction("J1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J2", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J2" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "R1",
      targetNodeId: "J1",
    });

    expect(moment.note).toBe("Merge junction into reservoir");
    expect(moment.deleteAssets).toEqual(["J1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("R1");
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(100);
  });

  it("merges junction into reservoir with reservoir surviving due to priority", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20], elevation: 100 })
      .aReservoir("R1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J2", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "R1",
    });

    expect(moment.note).toBe("Merge junction into reservoir");
    expect(moment.deleteAssets).toEqual(["J1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("R1");
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges tank into tank with source winning (same type, default rule)", () => {
    const model = HydraulicModelBuilder.with()
      .aTank("T1", { coordinates: [10, 20], elevation: 100 })
      .aTank("T2", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J1", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "T1", endNodeId: "J1" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "T1",
      targetNodeId: "T2",
    });

    expect(moment.note).toBe("Merge tank into tank");
    expect(moment.deleteAssets).toEqual(["T2"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("T1");
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(100);
  });

  it("merges reservoir into reservoir with source winning (same type, default rule)", () => {
    const model = HydraulicModelBuilder.with()
      .aReservoir("R1", { coordinates: [10, 20], elevation: 100 })
      .aReservoir("R2", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J1", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "R1", endNodeId: "J1" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "R1",
      targetNodeId: "R2",
    });

    expect(moment.note).toBe("Merge reservoir into reservoir");
    expect(moment.deleteAssets).toEqual(["R2"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("R1");
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(100);
  });

  it("updates loser link coordinates when junction merges into reservoir", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20], elevation: 100 })
      .aReservoir("R1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J2", { coordinates: [50, 60] })
      .aJunction("J3", { coordinates: [70, 80] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .aPipe("P2", { startNodeId: "J3", endNodeId: "J1" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "R1",
    });

    expect(moment.deleteAssets).toEqual(["J1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("R1");
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe1 = moment.putAssets!.find(
      (asset) => asset.id === "P1",
    ) as LinkAsset;
    expect(updatedPipe1.connections[0]).toBe("R1");
    expect(updatedPipe1.connections[1]).toBe("J2");
    expect(updatedPipe1.coordinates[0]).toEqual([30, 40]);
    expect(updatedPipe1.coordinates[1]).toEqual([50, 60]);

    const updatedPipe2 = moment.putAssets!.find(
      (asset) => asset.id === "P2",
    ) as LinkAsset;
    expect(updatedPipe2.connections[0]).toBe("J3");
    expect(updatedPipe2.connections[1]).toBe("R1");
    expect(updatedPipe2.coordinates[0]).toEqual([70, 80]);
    expect(updatedPipe2.coordinates[1]).toEqual([30, 40]);
  });

  it("updates loser link coordinates when junction merges into tank", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20], elevation: 100 })
      .aTank("T1", { coordinates: [30, 40], elevation: 150 })
      .aJunction("J2", { coordinates: [50, 60] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J2" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "T1",
    });

    expect(moment.deleteAssets).toEqual(["J1"]);

    const survivingNode = moment.putAssets![0] as NodeAsset;
    expect(survivingNode.id).toBe("T1");
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe = moment.putAssets!.find(
      (asset) => asset.id === "P1",
    ) as LinkAsset;
    expect(updatedPipe.connections[0]).toBe("T1");
    expect(updatedPipe.connections[1]).toBe("J2");
    expect(updatedPipe.coordinates[0]).toEqual([30, 40]);
    expect(updatedPipe.coordinates[1]).toEqual([50, 60]);
  });

  it("throws error for invalid source node ID", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20] })
      .build();

    expect(() => {
      mergeNodes(model, {
        sourceNodeId: "INVALID",
        targetNodeId: "J1",
      });
    }).toThrow("Invalid source node ID: INVALID");
  });

  it("throws error for invalid target node ID", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20] })
      .build();

    expect(() => {
      mergeNodes(model, {
        sourceNodeId: "J1",
        targetNodeId: "INVALID",
      });
    }).toThrow("Invalid target node ID: INVALID");
  });

  it("updates coordinates of pipes connected to source node", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [0, 0] })
      .aJunction("J2", { coordinates: [100, 100] })
      .aJunction("J3", { coordinates: [200, 0] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J3" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "J2",
    });

    const updatedPipe = moment.putAssets!.find(
      (asset) => asset.id === "P1",
    ) as LinkAsset;
    expect(updatedPipe.coordinates[0]).toEqual([100, 100]);
    expect(updatedPipe.coordinates[updatedPipe.coordinates.length - 1]).toEqual(
      [200, 0],
    );
  });

  it("handles node with connections at both ends of pipe", () => {
    const model = HydraulicModelBuilder.with()
      .aJunction("J1", { coordinates: [10, 20] })
      .aJunction("J2", { coordinates: [30, 40] })
      .aJunction("J3", { coordinates: [50, 60] })
      .aJunction("J4", { coordinates: [70, 80] })
      .aPipe("P1", { startNodeId: "J1", endNodeId: "J3" })
      .aPipe("P2", { startNodeId: "J4", endNodeId: "J2" })
      .build();

    const moment = mergeNodes(model, {
      sourceNodeId: "J1",
      targetNodeId: "J2",
    });

    const pipe1 = moment.putAssets!.find((a) => a.id === "P1") as LinkAsset;
    const pipe2 = moment.putAssets!.find((a) => a.id === "P2") as LinkAsset;

    expect(pipe1.connections[0]).toBe("J1");
    expect(pipe1.coordinates[0]).toEqual([30, 40]);

    expect(pipe2.connections[1]).toBe("J1");
  });
});
