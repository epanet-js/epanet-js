import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { applyOperation } from "src/__helpers__/apply-operation";
import { buildTestFactories } from "src/__helpers__/test-factories";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ChangeSet } from "@epanet-js/change-set";
import { mergeNodes } from "./merge-nodes";
import {
  AssetId,
  NodeAsset,
  LinkAsset,
  getJunctionDemands,
  getLinkLevelSetting,
} from "@epanet-js/hydraulic-model";

const { labelManager } = buildTestFactories();

const merge = (
  model: HydraulicModel,
  sourceNodeId: AssetId,
  targetNodeId: AssetId,
) => {
  const changeSet = mergeNodes(model, {
    lengthUnit: "m",
    sourceNodeId,
    targetNodeId,
  });
  applyOperation(model, changeSet, labelManager);
  return changeSet;
};

const changedEntities = (changeSet: ChangeSet) =>
  changeSet
    .summary()
    .map(({ entity, kind, count }) => `${entity}:${kind}:${count}`)
    .sort();

const nodeOf = (model: HydraulicModel, nodeId: AssetId) =>
  model.assets.get(nodeId) as NodeAsset;

const linkOf = (model: HydraulicModel, linkId: AssetId) =>
  model.assets.get(linkId) as LinkAsset;

describe("mergeNodes", () => {
  describe("demands merging", () => {
    it("concatenates demands from both junctions", () => {
      const IDS = { J1: 1, J2: 2, PAT1: 3, PAT2: 4 };
      const model = HydraulicModelBuilder.with({ labelManager })
        .aDemandPattern(IDS.PAT1, "PATTERN1", [1.0])
        .aDemandPattern(IDS.PAT2, "PATTERN2", [1.0])
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
          elevation: 100,
        })
        .aJunctionDemand(IDS.J1, [
          { baseDemand: 20 },
          { baseDemand: 50, patternId: IDS.PAT1 },
        ])
        .aJunction(IDS.J2, {
          coordinates: [30, 40],
          elevation: 150,
        })
        .aJunctionDemand(IDS.J2, [
          { baseDemand: 30 },
          { baseDemand: 40, patternId: IDS.PAT2 },
        ])
        .build();

      merge(model, IDS.J1, IDS.J2);

      expect(model.assets.has(IDS.J1)).toBe(true);
      expect(model.assets.has(IDS.J2)).toBe(false);
      expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([
        { baseDemand: 20 },
        { baseDemand: 50, patternId: IDS.PAT1 },
        { baseDemand: 30 },
        { baseDemand: 40, patternId: IDS.PAT2 },
      ]);
      expect(getJunctionDemands(model.demands, IDS.J2)).toEqual([]);
    });

    it("handles empty demands arrays", () => {
      const IDS = { J1: 1, J2: 2 };
      const model = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
        })
        .aJunctionDemand(IDS.J1, [])
        .aJunction(IDS.J2, {
          coordinates: [30, 40],
        })
        .aJunctionDemand(IDS.J2, [])
        .build();

      merge(model, IDS.J1, IDS.J2);

      expect(model.assets.has(IDS.J1)).toBe(true);
      expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([]);
    });

    it("clears loser junction demands when merging junction into tank", () => {
      const IDS = { J1: 1, T1: 2 };
      const model = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
          elevation: 100,
        })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 50 }])
        .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
        .build();

      const changeSet = merge(model, IDS.J1, IDS.T1);

      expect(nodeOf(model, IDS.T1).type).toBe("tank");
      expect(model.assets.has(IDS.J1)).toBe(false);
      expect(changedEntities(changeSet)).toContain("junctionDemand:update:1");
      expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([]);
    });

    it("clears loser junction demands when merging tank into junction", () => {
      const IDS = { T1: 1, J1: 2 };
      const model = HydraulicModelBuilder.with({ labelManager })
        .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
        .aJunction(IDS.J1, {
          coordinates: [30, 40],
          elevation: 150,
        })
        .aJunctionDemand(IDS.J1, [{ baseDemand: 60 }])
        .build();

      const changeSet = merge(model, IDS.T1, IDS.J1);

      expect(nodeOf(model, IDS.T1).type).toBe("tank");
      expect(model.assets.has(IDS.J1)).toBe(false);
      expect(changedEntities(changeSet)).toContain("junctionDemand:update:1");
      expect(getJunctionDemands(model.demands, IDS.J1)).toEqual([]);
    });

    it("does not touch demands when loser junction has no demands", () => {
      const IDS = { J1: 1, T1: 2 };
      const model = HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .aTank(IDS.T1, { coordinates: [30, 40] })
        .build();

      const changeSet = merge(model, IDS.J1, IDS.T1);

      expect(changedEntities(changeSet)).not.toContainEqual(
        expect.stringMatching(/^junctionDemand:/),
      );
    });
  });

  it("merges J1 into J2 position with J1 surviving", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, {
        coordinates: [10, 20],
        elevation: 100,
      })
      .aJunction(IDS.J2, {
        coordinates: [30, 40],
        elevation: 150,
      })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3, isActive: true })
      .build();

    const changeSet = merge(model, IDS.J1, IDS.J2);

    expect(changeSet.name).toBe("mergeNodes");
    expect(changedEntities(changeSet)).toEqual([
      "junction:delete:1",
      "junction:update:1",
      "pipe:update:1",
    ]);
    expect(model.assets.has(IDS.J2)).toBe(false);

    const survivingNode = nodeOf(model, IDS.J1);
    expect(survivingNode.type).toBe("junction");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
    expect(survivingNode.isActive).toBe(true);

    const updatedPipe = linkOf(model, IDS.P1);
    expect(updatedPipe.connections).toEqual([IDS.J1, IDS.J3]);
    expect(updatedPipe.coordinates[0]).toEqual([30, 40]);
  });

  it("merges junction into tank with tank surviving due to priority", () => {
    const IDS = { J1: 1, T1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const changeSet = merge(model, IDS.J1, IDS.T1);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.J1)).toBe(false);

    const survivingNode = nodeOf(model, IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges tank into junction with tank surviving due to priority", () => {
    const IDS = { T1: 1, J1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J2 })
      .build();

    const changeSet = merge(model, IDS.T1, IDS.J1);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.J1)).toBe(false);

    const survivingNode = nodeOf(model, IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges nodes with multiple connections from both nodes", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aJunction(IDS.J4, { coordinates: [70, 80] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3, isActive: true })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J4, isActive: true })
      .build();

    const changeSet = merge(model, IDS.J1, IDS.J2);

    expect(changedEntities(changeSet)).toEqual([
      "junction:delete:1",
      "junction:update:1",
      "pipe:update:2",
    ]);

    const survivingNode = nodeOf(model, IDS.J1);
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.isActive).toBe(true);

    const updatedPipe1 = linkOf(model, IDS.P1);
    expect(updatedPipe1.connections).toEqual([IDS.J1, IDS.J3]);
    expect(updatedPipe1.coordinates[0]).toEqual([30, 40]);

    const updatedPipe2 = linkOf(model, IDS.P2);
    expect(updatedPipe2.connections).toEqual([IDS.J1, IDS.J4]);
    expect(model.topology.getNodes(IDS.P2)).toEqual([IDS.J1, IDS.J4]);
  });

  it("preserves parallel links when merging nodes with shared connections", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4, P2: 5 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J2, endNodeId: IDS.J3 })
      .build();

    merge(model, IDS.J1, IDS.J2);

    expect(linkOf(model, IDS.P1).connections).toContain(IDS.J1);
    expect(linkOf(model, IDS.P2).connections).toContain(IDS.J1);
  });

  it("merges nodes with no connections", () => {
    const IDS = { J1: 1, J2: 2 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .build();

    const changeSet = merge(model, IDS.J1, IDS.J2);

    expect(changedEntities(changeSet)).toEqual([
      "junction:delete:1",
      "junction:update:1",
    ]);
    expect(model.assets.has(IDS.J2)).toBe(false);
    expect(nodeOf(model, IDS.J1).coordinates).toEqual([30, 40]);
  });

  it("merges reservoir into tank with source winning (same priority, default rule)", () => {
    const IDS = { R1: 1, T1: 2, J1: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aReservoir(IDS.R1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J1, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const changeSet = merge(model, IDS.R1, IDS.T1);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.T1)).toBe(false);

    const survivingNode = nodeOf(model, IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
  });

  it("merges reservoir into junction with reservoir surviving due to priority", () => {
    const IDS = { R1: 1, J1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aReservoir(IDS.R1, { coordinates: [10, 20], elevation: 100 })
      .aJunction(IDS.J1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J2 })
      .build();

    const changeSet = merge(model, IDS.R1, IDS.J1);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.J1)).toBe(false);

    const survivingNode = nodeOf(model, IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges junction into reservoir with reservoir surviving due to priority", () => {
    const IDS = { J1: 1, R1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aReservoir(IDS.R1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    const changeSet = merge(model, IDS.J1, IDS.R1);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.J1)).toBe(false);

    const survivingNode = nodeOf(model, IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges tank into tank with source winning (same type, default rule)", () => {
    const IDS = { T1: 1, T2: 2, J1: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T2, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J1, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.T1, endNodeId: IDS.J1 })
      .build();

    const changeSet = merge(model, IDS.T1, IDS.T2);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.T2)).toBe(false);

    const survivingNode = nodeOf(model, IDS.T1);
    expect(survivingNode.type).toBe("tank");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("merges reservoir into reservoir with source winning (same type, default rule)", () => {
    const IDS = { R1: 1, R2: 2, J1: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aReservoir(IDS.R1, { coordinates: [10, 20], elevation: 100 })
      .aReservoir(IDS.R2, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J1, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.R1, endNodeId: IDS.J1 })
      .build();

    const changeSet = merge(model, IDS.R1, IDS.R2);

    expect(changeSet.name).toBe("mergeNodes");
    expect(model.assets.has(IDS.R2)).toBe(false);

    const survivingNode = nodeOf(model, IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);
    expect(survivingNode.elevation).toBe(150);
  });

  it("updates loser link coordinates when junction merges into reservoir", () => {
    const IDS = { J1: 1, R1: 2, J2: 3, J3: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aReservoir(IDS.R1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aJunction(IDS.J3, { coordinates: [70, 80] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .aPipe(IDS.P2, { startNodeId: IDS.J3, endNodeId: IDS.J1 })
      .build();

    merge(model, IDS.J1, IDS.R1);

    expect(model.assets.has(IDS.J1)).toBe(false);

    const survivingNode = nodeOf(model, IDS.R1);
    expect(survivingNode.type).toBe("reservoir");
    expect(survivingNode.coordinates).toEqual([30, 40]);

    const updatedPipe1 = linkOf(model, IDS.P1);
    expect(updatedPipe1.connections).toEqual([IDS.R1, IDS.J2]);
    expect(updatedPipe1.coordinates).toEqual([
      [30, 40],
      [50, 60],
    ]);

    const updatedPipe2 = linkOf(model, IDS.P2);
    expect(updatedPipe2.connections).toEqual([IDS.J3, IDS.R1]);
    expect(updatedPipe2.coordinates).toEqual([
      [70, 80],
      [30, 40],
    ]);
  });

  it("updates loser link coordinates when junction merges into tank", () => {
    const IDS = { J1: 1, T1: 2, J2: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20], elevation: 100 })
      .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
      .aJunction(IDS.J2, { coordinates: [50, 60] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
      .build();

    merge(model, IDS.J1, IDS.T1);

    expect(model.assets.has(IDS.J1)).toBe(false);
    expect(nodeOf(model, IDS.T1).coordinates).toEqual([30, 40]);

    const updatedPipe = linkOf(model, IDS.P1);
    expect(updatedPipe.connections).toEqual([IDS.T1, IDS.J2]);
    expect(model.topology.getNodes(IDS.P1)).toEqual([IDS.T1, IDS.J2]);
    expect(updatedPipe.coordinates).toEqual([
      [30, 40],
      [50, 60],
    ]);
  });

  it("throws error for invalid source node ID", () => {
    const IDS = { J1: 1 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .build();

    expect(() => {
      mergeNodes(model, {
        lengthUnit: "m",
        sourceNodeId: 999,
        targetNodeId: IDS.J1,
      });
    }).toThrow("Invalid source node ID: 999");
  });

  it("throws error for invalid target node ID", () => {
    const IDS = { J1: 1 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .build();

    expect(() => {
      mergeNodes(model, {
        lengthUnit: "m",
        sourceNodeId: IDS.J1,
        targetNodeId: 999,
      });
    }).toThrow("Invalid target node ID: 999");
  });

  it("updates coordinates of pipes connected to source node", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [0, 0] })
      .aJunction(IDS.J2, { coordinates: [100, 100] })
      .aJunction(IDS.J3, { coordinates: [200, 0] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .build();

    merge(model, IDS.J1, IDS.J2);

    const updatedPipe = linkOf(model, IDS.P1);
    expect(updatedPipe.coordinates[0]).toEqual([100, 100]);
    expect(updatedPipe.coordinates[updatedPipe.coordinates.length - 1]).toEqual(
      [200, 0],
    );
  });

  it("handles node with connections at both ends of pipe", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40] })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aJunction(IDS.J4, { coordinates: [70, 80] })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3 })
      .aPipe(IDS.P2, { startNodeId: IDS.J4, endNodeId: IDS.J2 })
      .build();

    merge(model, IDS.J1, IDS.J2);

    const pipe1 = linkOf(model, IDS.P1);
    expect(pipe1.connections[0]).toBe(IDS.J1);
    expect(pipe1.coordinates[0]).toEqual([30, 40]);

    expect(linkOf(model, IDS.P2).connections[1]).toBe(IDS.J1);
  });

  it("sets merged node active when any connected link is active", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20] })
      .aJunction(IDS.J2, { coordinates: [30, 40], isActive: false })
      .aJunction(IDS.J3, { coordinates: [50, 60] })
      .aJunction(IDS.J4, { coordinates: [70, 80], isActive: false })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J3, isActive: true })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J4,
        isActive: false,
      })
      .build();

    merge(model, IDS.J1, IDS.J2);

    expect(nodeOf(model, IDS.J1).isActive).toBe(true);
  });

  it("sets merged node inactive when all connected links are inactive", () => {
    const IDS = { J1: 1, J2: 2, J3: 3, J4: 4, P1: 5, P2: 6 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20], isActive: false })
      .aJunction(IDS.J2, { coordinates: [30, 40], isActive: false })
      .aJunction(IDS.J3, { coordinates: [50, 60], isActive: false })
      .aJunction(IDS.J4, { coordinates: [70, 80], isActive: false })
      .aPipe(IDS.P1, {
        startNodeId: IDS.J1,
        endNodeId: IDS.J3,
        isActive: false,
      })
      .aPipe(IDS.P2, {
        startNodeId: IDS.J2,
        endNodeId: IDS.J4,
        isActive: false,
      })
      .build();

    merge(model, IDS.J1, IDS.J2);

    expect(nodeOf(model, IDS.J1).isActive).toBe(false);
  });

  it("sets merged node inactive when merging isolated nodes", () => {
    const IDS = { J1: 1, J2: 2 };
    const model = HydraulicModelBuilder.with({ labelManager })
      .aJunction(IDS.J1, { coordinates: [10, 20], isActive: false })
      .aJunction(IDS.J2, { coordinates: [30, 40], isActive: true })
      .build();

    merge(model, IDS.J1, IDS.J2);

    expect(nodeOf(model, IDS.J1).isActive).toBe(true);
  });

  describe("controls", () => {
    const IDS = { J1: 1, J2: 2, PU1: 3, T1: 4, T2: 5, R1: 6 } as const;

    const buildModelWithLevelControlOnT2 = () =>
      HydraulicModelBuilder.with({ labelManager })
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPump(IDS.PU1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aTank(IDS.T1, { coordinates: [20, 0] })
        .aTank(IDS.T2, { coordinates: [30, 0] })
        .aReservoir(IDS.R1, { coordinates: [40, 0] })
        .aLevelSettingControl({
          linkId: IDS.PU1,
          tankId: IDS.T2,
          on: { level: 1, setting: 1 },
          off: { level: 5 },
        })
        .build();

    it("re-points a level-setting control to the surviving tank", () => {
      const model = buildModelWithLevelControlOnT2();

      merge(model, IDS.T1, IDS.T2);

      expect(getLinkLevelSetting(model.controls, IDS.PU1)?.tankId).toBe(IDS.T1);
      expect(model.controlsLookup.hasControls(IDS.T2)).toBe(false);
    });

    it("removes a level-setting control when its tank merges into a reservoir", () => {
      const model = buildModelWithLevelControlOnT2();

      merge(model, IDS.R1, IDS.T2);

      expect(getLinkLevelSetting(model.controls, IDS.PU1)).toBeNull();
    });
  });
});
