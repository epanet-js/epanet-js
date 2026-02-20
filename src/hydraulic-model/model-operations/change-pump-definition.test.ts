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
});
