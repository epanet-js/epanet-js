import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { Pump } from "../asset-types";
import { changePumpDefinition } from "./change-pump-definition";

const IDS = {
  node1: 1,
  node2: 2,
  pump: 10,
  curveA: 100,
  curveB: 200,
} as const;

const curvePoints = [
  { x: 0, y: 50 },
  { x: 10, y: 40 },
  { x: 20, y: 20 },
];

describe("changePumpDefinition", () => {
  describe("pump properties", () => {
    it("changes to power definition", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curve",
          curve: curvePoints,
        })
        .build();

      const { putAssets } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "power", power: 50 },
      });

      const pump = putAssets![0] as Pump;
      expect(pump.definitionType).toBe("power");
      expect(pump.power).toBe(50);
    });

    it("changes to inline curve definition", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "power",
          power: 50,
        })
        .build();

      const { putAssets } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curve", curve: curvePoints },
      });

      const pump = putAssets![0] as Pump;
      expect(pump.definitionType).toBe("curve");
      expect(pump.curve).toEqual(curvePoints);
    });

    it("changes to curveId definition", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curve",
          curve: curvePoints,
        })
        .aPumpCurve({ id: IDS.curveA, points: curvePoints })
        .build();

      const { putAssets } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curveId", curveId: IDS.curveA },
      });

      const pump = putAssets![0] as Pump;
      expect(pump.definitionType).toBe("curveId");
      expect(pump.curveId).toBe(IDS.curveA);
    });

    it("clears curveId when switching from curveId to power", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPumpCurve({
          id: IDS.curveA,
          points: curvePoints,
          assetIds: new Set([IDS.pump]),
        })
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .build();

      const { putAssets } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "power", power: 50 },
      });

      const pump = putAssets![0] as Pump;
      expect(pump.curveId).toBeUndefined();
    });

    it("clears curveId when switching from curveId to inline curve", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPumpCurve({
          id: IDS.curveA,
          points: curvePoints,
          assetIds: new Set([IDS.pump]),
        })
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .build();

      const { putAssets } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curve", curve: curvePoints },
      });

      const pump = putAssets![0] as Pump;
      expect(pump.curveId).toBeUndefined();
    });
  });

  describe("curve assetIds", () => {
    it("adds pump to curve assetIds when switching to curveId", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "power",
          power: 50,
        })
        .aPumpCurve({ id: IDS.curveA, points: curvePoints })
        .build();

      const { putCurves } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curveId", curveId: IDS.curveA },
      });

      expect(putCurves).toBeDefined();
      expect(putCurves!.get(IDS.curveA)!.assetIds.has(IDS.pump)).toBe(true);
    });

    it("removes pump from curve assetIds when switching away from curveId", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPumpCurve({
          id: IDS.curveA,
          points: curvePoints,
          assetIds: new Set([IDS.pump]),
        })
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .build();

      const { putCurves } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "power", power: 50 },
      });

      expect(putCurves).toBeDefined();
      expect(putCurves!.get(IDS.curveA)!.assetIds.has(IDS.pump)).toBe(false);
    });

    it("moves pump between curves when switching curveId", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPumpCurve({
          id: IDS.curveA,
          points: curvePoints,
          assetIds: new Set([IDS.pump]),
        })
        .aPumpCurve({ id: IDS.curveB, points: [{ x: 5, y: 30 }] })
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .build();

      const { putCurves } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curveId", curveId: IDS.curveB },
      });

      expect(putCurves).toBeDefined();
      expect(putCurves!.get(IDS.curveA)!.assetIds.has(IDS.pump)).toBe(false);
      expect(putCurves!.get(IDS.curveB)!.assetIds.has(IDS.pump)).toBe(true);
    });

    it("does not return putCurves when curveId is unchanged", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPumpCurve({
          id: IDS.curveA,
          points: curvePoints,
          assetIds: new Set([IDS.pump]),
        })
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .build();

      const { putCurves } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curveId", curveId: IDS.curveA },
      });

      expect(putCurves).toBeUndefined();
    });

    it("does not return putCurves when no curves are involved", () => {
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "power",
          power: 50,
        })
        .build();

      const { putCurves } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "curve", curve: curvePoints },
      });

      expect(putCurves).toBeUndefined();
    });

    it("preserves other pumps in curve assetIds", () => {
      const otherPumpId = 11;
      const model = HydraulicModelBuilder.with()
        .aNode(IDS.node1)
        .aNode(IDS.node2)
        .aNode(3)
        .aNode(4)
        .aPumpCurve({
          id: IDS.curveA,
          points: curvePoints,
          assetIds: new Set([IDS.pump, otherPumpId]),
        })
        .aPump(IDS.pump, {
          startNodeId: IDS.node1,
          endNodeId: IDS.node2,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .aPump(otherPumpId, {
          startNodeId: 3,
          endNodeId: 4,
          definitionType: "curveId",
          curveId: IDS.curveA,
        })
        .build();

      const { putCurves } = changePumpDefinition(model, {
        pumpId: IDS.pump,
        data: { type: "power", power: 50 },
      });

      expect(putCurves).toBeDefined();
      const curveAssetIds = putCurves!.get(IDS.curveA)!.assetIds;
      expect(curveAssetIds.has(IDS.pump)).toBe(false);
      expect(curveAssetIds.has(otherPumpId)).toBe(true);
    });
  });
});
