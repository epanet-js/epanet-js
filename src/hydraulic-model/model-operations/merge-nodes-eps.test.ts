import { describe, it, expect } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { mergeNodesEps } from "./merge-nodes-eps";
import { NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";
import { Junction } from "src/hydraulic-model/asset-types/junction";

describe("mergeNodesEps", () => {
  describe("demands merging", () => {
    it("concatenates demands from both junctions", () => {
      const IDS = { J1: 1, J2: 2 };
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
          elevation: 100,
          demands: [
            { baseDemand: 20 },
            { baseDemand: 50, patternId: "pattern1" },
          ],
        })
        .aJunction(IDS.J2, {
          coordinates: [30, 40],
          elevation: 150,
          demands: [
            { baseDemand: 30 },
            { baseDemand: 40, patternId: "pattern2" },
          ],
        })
        .build();

      const moment = mergeNodesEps(model, {
        sourceNodeId: IDS.J1,
        targetNodeId: IDS.J2,
      });

      const survivingJunction = moment.putAssets![0] as Junction;
      expect(survivingJunction.id).toBe(IDS.J1);
      expect(survivingJunction.demands).toEqual([
        { baseDemand: 20 },
        { baseDemand: 50, patternId: "pattern1" },
        { baseDemand: 30 },
        { baseDemand: 40, patternId: "pattern2" },
      ]);
    });

    it("handles empty demands arrays", () => {
      const IDS = { J1: 1, J2: 2 };
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
          demands: [],
        })
        .aJunction(IDS.J2, {
          coordinates: [30, 40],
          demands: [],
        })
        .build();

      const moment = mergeNodesEps(model, {
        sourceNodeId: IDS.J1,
        targetNodeId: IDS.J2,
      });

      const survivingJunction = moment.putAssets![0] as Junction;
      expect(survivingJunction.demands).toEqual([]);
    });

    it("does not merge demands when merging junction into tank", () => {
      const IDS = { J1: 1, T1: 2 };
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
          elevation: 100,
          demands: [{ baseDemand: 50 }],
        })
        .aTank(IDS.T1, { coordinates: [30, 40], elevation: 150 })
        .build();

      const moment = mergeNodesEps(model, {
        sourceNodeId: IDS.J1,
        targetNodeId: IDS.T1,
      });

      const survivingNode = moment.putAssets![0] as NodeAsset;
      expect(survivingNode.id).toBe(IDS.T1);
      expect(survivingNode.type).toBe("tank");
      expect((survivingNode as any).demands).toBeUndefined();
    });

    it("does not merge demands when merging tank into junction", () => {
      const IDS = { T1: 1, J1: 2 };
      const model = HydraulicModelBuilder.with()
        .aTank(IDS.T1, { coordinates: [10, 20], elevation: 100 })
        .aJunction(IDS.J1, {
          coordinates: [30, 40],
          elevation: 150,
          demands: [{ baseDemand: 60 }],
        })
        .build();

      const moment = mergeNodesEps(model, {
        sourceNodeId: IDS.T1,
        targetNodeId: IDS.J1,
      });

      const survivingNode = moment.putAssets![0] as NodeAsset;
      expect(survivingNode.id).toBe(IDS.T1);
      expect(survivingNode.type).toBe("tank");
      expect((survivingNode as any).demands).toBeUndefined();
    });
  });

  describe("basic merge behavior", () => {
    it("merges J1 into J2 position with J1 surviving", () => {
      const IDS = { J1: 1, J2: 2, J3: 3, P1: 4 };
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, {
          coordinates: [10, 20],
          elevation: 100,
        })
        .aJunction(IDS.J2, {
          coordinates: [30, 40],
          elevation: 150,
        })
        .aJunction(IDS.J3, { coordinates: [50, 60] })
        .aPipe(IDS.P1, {
          startNodeId: IDS.J1,
          endNodeId: IDS.J3,
          isActive: true,
        })
        .build();

      const moment = mergeNodesEps(model, {
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
      expect(survivingNode.isActive).toBe(true);

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

      const moment = mergeNodesEps(model, {
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

    it("throws error for invalid source node ID", () => {
      const IDS = { J1: 1 };
      const model = HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [10, 20] })
        .build();

      expect(() => {
        mergeNodesEps(model, {
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
        mergeNodesEps(model, {
          sourceNodeId: IDS.J1,
          targetNodeId: 999,
        });
      }).toThrow("Invalid target node ID: 999");
    });
  });
});
