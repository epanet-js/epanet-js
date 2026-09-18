import { describe, it, expect } from "vitest";
import type {
  AssetFactory,
  LinkAsset,
  NodeAsset,
} from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import {
  modelLabels,
  snapshot,
  withoutIndexOrder,
  type ModelFixture,
} from "src/__helpers__/model-snapshot";
import type { ModelMoment } from "../model-operation";
import {
  addNode,
  changeAssetControl,
  changeCurves,
  changeCustomAttributesDefinition,
  changeCustomerPointLabel,
  changeDemandAssignment,
  changeLabel,
  changePatterns,
  changePipeMaterials,
  changeProperty,
  changeRawControls,
  deleteAssets,
  disconnectCustomers,
  moveCustomerPoint,
  removeCustomerPoints,
  replaceLink,
} from "../model-operations";
import { deactivateAssets } from "../model-operations/deactivate-assets";
import { reverseLink } from "../model-operations/reverse-link";
import {
  emptyCustomAttributesDefinition,
  getAttributes,
  getLinkTimedSetting,
} from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { applyChangeSet } from "./apply";
import { toChangeSet } from "./from-moment";

const IDS = {
  J1: 1,
  J2: 2,
  P1: 3,
  T1: 4,
  J3: 5,
  CP1: 6,
  C1: 10,
  PAT1: 20,
  R1: 30,
  PU1: 31,
  V1: 32,
  J4: 33,
  J5: 34,
} as const;

type Fixture = ModelFixture & { assetFactory: AssetFactory };

const aNetwork = (): Fixture => {
  const { labelManager, assetFactory, idGenerator } = buildTestFactories();
  const model = HydraulicModelBuilder.with({
    labelManager,
    assetFactory,
    idGenerator,
  })
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [10, 0], elevation: 20 })
    .aJunction(IDS.J3, { coordinates: [20, 0], elevation: 30 })
    .aTank(IDS.T1, { coordinates: [30, 0] })
    .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2, diameter: 200 })
    .aReservoir(IDS.R1, { coordinates: [40, 0], head: 100 })
    .aJunction(IDS.J4, { coordinates: [50, 0], elevation: 5 })
    .aPump(IDS.PU1, { startNodeId: IDS.R1, endNodeId: IDS.J4 })
    .aJunction(IDS.J5, { coordinates: [60, 0], elevation: 6 })
    .aValve(IDS.V1, {
      startNodeId: IDS.J4,
      endNodeId: IDS.J5,
      diameter: 150,
      setting: 3,
    })
    .aCurve({ id: IDS.C1, type: "volume", points: [{ x: 1, y: 1 }] })
    .aPattern(IDS.PAT1, "PAT1", [1, 2, 3])
    .aCustomAttribute("junction", {
      id: "custom-1",
      label: "Zone",
      type: "text",
    })
    .aCustomerPoint(IDS.CP1, {
      coordinates: [5, 1],
      connection: { pipeId: IDS.P1, junctionId: IDS.J1 },
    })
    .aJunctionDemand(IDS.J1, [{ baseDemand: 5 }])
    .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 2 }])
    .build();

  model.assets.get(IDS.J1)!.setProperty("custom-1", "NORTH");

  for (const point of model.customerPoints.values()) {
    labelManager.register(point.label, "customerPoint", point.id);
  }

  return { model, labelManager, assetFactory };
};

type OperationCase = {
  name: string;
  fixture: () => Fixture;
  run: (fixture: Fixture) => ModelMoment;
  expectApplied: (fixture: Fixture) => void;
};

const prop = (model: HydraulicModel, id: number, name: string) =>
  model.assets.get(id)?.getProperty(name);

const linkBetween = (model: HydraulicModel, start: number, end: number) =>
  [...model.assets.values()].find(
    (asset): asset is LinkAsset =>
      asset.isLink &&
      (asset as LinkAsset).connections[0] === start &&
      (asset as LinkAsset).connections[1] === end,
  );

const cases: OperationCase[] = [
  {
    name: "changeProperty",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.P1],
        property: "diameter",
        value: 300,
      }),
    expectApplied: ({ model }) => {
      expect(prop(model, IDS.P1, "diameter")).toBe(300);
    },
  },
  {
    name: "changeProperty over several assets",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.J1, IDS.J2, IDS.J3],
        property: "elevation",
        value: 55,
      }),
    expectApplied: ({ model }) => {
      for (const id of [IDS.J1, IDS.J2, IDS.J3]) {
        expect(prop(model, id, "elevation")).toBe(55);
      }
    },
  },
  {
    name: "changeLabel",
    fixture: aNetwork,
    run: ({ model }) =>
      changeLabel(model, { assetId: IDS.J1, newLabel: "RENAMED" }),
    expectApplied: ({ model, labelManager }) => {
      expect(prop(model, IDS.J1, "label")).toBe("RENAMED");
      expect(labelManager.getIdByLabel("RENAMED", "junction")).toBe(IDS.J1);
    },
  },
  {
    name: "addNode",
    fixture: aNetwork,
    run: ({ model, assetFactory, labelManager }) =>
      addNode(model, {
        nodeType: "junction",
        coordinates: [40, 40],
        elevation: 12,
        lengthUnit: "m",
        assetFactory,
        labelManager,
      }),
    expectApplied: ({ model }) => {
      const added = [...model.assets.values()].find(
        (asset) =>
          !asset.isLink &&
          (asset as NodeAsset).coordinates[0] === 40 &&
          (asset as NodeAsset).coordinates[1] === 40,
      );
      expect(added?.type).toBe("junction");
      expect(added?.getProperty("elevation")).toBe(12);
    },
  },
  {
    name: "deleteAssets on a link",
    fixture: aNetwork,
    run: ({ model }) =>
      deleteAssets(model, {
        assetIds: [IDS.P1],
        shouldUpdateCustomerPoints: true,
      }),
    expectApplied: ({ model }) => {
      expect(model.assets.has(IDS.P1)).toBe(false);
      expect(model.customerPoints.get(IDS.CP1)?.connection).toBeNull();
    },
  },
  {
    name: "deleteAssets on a node with links",
    fixture: aNetwork,
    run: ({ model }) =>
      deleteAssets(model, {
        assetIds: [IDS.J1],
        shouldUpdateCustomerPoints: true,
      }),
    expectApplied: ({ model }) => {
      expect(model.assets.has(IDS.J1)).toBe(false);
      expect(model.assets.has(IDS.P1)).toBe(false);
    },
  },
  {
    name: "changeCurves",
    fixture: aNetwork,
    run: ({ model }) => {
      const curves = new Map(model.curves);
      curves.set(99, { id: 99, label: "C99", type: "volume", points: [] });
      return changeCurves(model, { curves });
    },
    expectApplied: ({ model }) => {
      expect(model.curves.get(99)).toEqual({
        id: 99,
        label: "C99",
        type: "volume",
        points: [],
      });
    },
  },
  {
    name: "changeDemandAssignment",
    fixture: aNetwork,
    run: ({ model }) =>
      changeDemandAssignment(model, [
        { junctionId: IDS.J2, demands: [{ baseDemand: 7 }] },
      ]),
    expectApplied: ({ model }) => {
      expect(model.demands.junctions.get(IDS.J2)).toEqual([{ baseDemand: 7 }]);
    },
  },
  {
    name: "changeDemandAssignment on a customer point",
    fixture: aNetwork,
    run: ({ model }) =>
      changeDemandAssignment(model, [
        { customerPointId: IDS.CP1, demands: [{ baseDemand: 8 }] },
      ]),
    expectApplied: ({ model }) => {
      expect(model.demands.customerPoints.get(IDS.CP1)).toEqual([
        { baseDemand: 8 },
      ]);
    },
  },
  {
    name: "changeProperty on a tank",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.T1],
        property: "maxLevel",
        value: 12,
      }),
    expectApplied: ({ model }) => {
      expect(prop(model, IDS.T1, "maxLevel")).toBe(12);
    },
  },
  {
    name: "deactivateAssets",
    fixture: aNetwork,
    run: ({ model }) => deactivateAssets(model, { assetIds: [IDS.P1] }),
    expectApplied: ({ model }) => {
      expect(prop(model, IDS.P1, "isActive")).toBe(false);
    },
  },
  {
    name: "reverseLink",
    fixture: aNetwork,
    run: ({ model }) => reverseLink(model, { linkId: IDS.P1 }),
    expectApplied: ({ model }) => {
      expect((model.assets.get(IDS.P1) as LinkAsset).connections).toEqual([
        IDS.J2,
        IDS.J1,
      ]);
    },
  },
  {
    name: "moveCustomerPoint",
    fixture: aNetwork,
    run: ({ model }) =>
      moveCustomerPoint(model, {
        customerPointId: IDS.CP1,
        newCoordinates: [6, 2],
      }),
    expectApplied: ({ model }) => {
      expect(model.customerPoints.get(IDS.CP1)?.coordinates).toEqual([6, 2]);
    },
  },
  {
    name: "disconnectCustomers",
    fixture: aNetwork,
    run: ({ model }) =>
      disconnectCustomers(model, { customerPointIds: [IDS.CP1] }),
    expectApplied: ({ model }) => {
      expect(model.customerPoints.get(IDS.CP1)?.connection).toBeNull();
    },
  },
  {
    name: "changeCustomerPointLabel",
    fixture: aNetwork,
    run: ({ model }) =>
      changeCustomerPointLabel(model, {
        customerPointId: IDS.CP1,
        newLabel: "CP-RENAMED",
      }),
    expectApplied: ({ model, labelManager }) => {
      expect(model.customerPoints.get(IDS.CP1)?.label).toBe("CP-RENAMED");
      expect(labelManager.isLabelAvailable("CP-RENAMED", "customerPoint")).toBe(
        false,
      );
    },
  },
  {
    name: "removeCustomerPoints",
    fixture: aNetwork,
    run: ({ model }) =>
      removeCustomerPoints(model, { customerPointIds: [IDS.CP1] }),
    expectApplied: ({ model }) => {
      expect(model.customerPoints.has(IDS.CP1)).toBe(false);
      expect(model.demands.customerPoints.has(IDS.CP1)).toBe(false);
    },
  },
  {
    name: "changePatterns",
    fixture: aNetwork,
    run: ({ model }) => {
      const patterns = new Map(model.patterns);
      patterns.set(99, { id: 99, label: "P99", multipliers: [4, 5] });
      return changePatterns(model, patterns);
    },
    expectApplied: ({ model }) => {
      expect(model.patterns.get(99)?.multipliers).toEqual([4, 5]);
    },
  },
  {
    name: "changeAssetControl",
    fixture: aNetwork,
    run: ({ model }) =>
      changeAssetControl(model, {
        assetId: IDS.P1,
        control: {
          id: "ctl-1",
          type: "timed-setting",
          linkId: IDS.P1,
          steps: [{ time: 0, status: "off", setting: 1 }],
        },
      }),
    expectApplied: ({ model }) => {
      expect(getLinkTimedSetting(model.controls, IDS.P1)?.steps).toEqual([
        { time: 0, status: "off", setting: 1 },
      ]);
    },
  },
  {
    name: "changeRawControls",
    fixture: aNetwork,
    run: ({ model }) =>
      changeRawControls(model, {
        simple: [{ template: "LINK 3 OPEN", assetReferences: [] }],
        rules: [],
      }),
    expectApplied: ({ model }) => {
      expect(model.rawControls.simple).toEqual([
        { template: "LINK 3 OPEN", assetReferences: [] },
      ]);
    },
  },
  {
    name: "changePipeMaterials",
    fixture: aNetwork,
    run: ({ model }) =>
      changePipeMaterials(model, [
        { label: "PVC", entries: [{ age: 0, roughness: 140 }] },
      ]),
    expectApplied: ({ model }) => {
      expect(model.pipeMaterials).toEqual([
        { label: "PVC", entries: [{ age: 0, roughness: 140 }] },
      ]);
    },
  },
  {
    name: "changeProperty on a reservoir",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.R1],
        property: "head",
        value: 120,
      }),
    expectApplied: ({ model }) => {
      expect(prop(model, IDS.R1, "head")).toBe(120);
    },
  },
  {
    name: "changeProperty on a pump",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.PU1],
        property: "speed",
        value: 2,
      }),
    expectApplied: ({ model }) => {
      expect(prop(model, IDS.PU1, "speed")).toBe(2);
    },
  },
  {
    name: "changeProperty on a valve",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.V1],
        property: "setting",
        value: 9,
      }),
    expectApplied: ({ model }) => {
      expect(prop(model, IDS.V1, "setting")).toBe(9);
    },
  },
  {
    name: "deleteAssets on a pump, carrying its curve",
    fixture: aNetwork,
    run: ({ model }) => deleteAssets(model, { assetIds: [IDS.PU1] }),
    expectApplied: ({ model }) => {
      expect(model.assets.has(IDS.PU1)).toBe(false);
    },
  },
  {
    name: "deleteAssets on a valve",
    fixture: aNetwork,
    run: ({ model }) => deleteAssets(model, { assetIds: [IDS.V1] }),
    expectApplied: ({ model }) => {
      expect(model.assets.has(IDS.V1)).toBe(false);
    },
  },
  {
    name: "deleteAssets on a reservoir",
    fixture: aNetwork,
    run: ({ model }) => deleteAssets(model, { assetIds: [IDS.R1] }),
    expectApplied: ({ model }) => {
      expect(model.assets.has(IDS.R1)).toBe(false);
      expect(model.assets.has(IDS.PU1)).toBe(false);
    },
  },
  {
    name: "changeCustomAttributesDefinition removing an attribute in use",
    fixture: aNetwork,
    run: ({ model }) =>
      changeCustomAttributesDefinition(
        model,
        emptyCustomAttributesDefinition(),
      ),
    expectApplied: ({ model }) => {
      expect(getAttributes(model.customAttributes, "junction")).toEqual([]);
      expect(prop(model, IDS.J1, "custom-1")).toBeNull();
    },
  },
  {
    name: "replaceLink redrawing a pipe between the same nodes",
    fixture: aNetwork,
    run: ({ model, assetFactory, labelManager }) => {
      const redrawn = (model.assets.get(IDS.P1) as LinkAsset).copy();
      redrawn.setCoordinates([
        [0, 0],
        [3, 3],
        [7, 3],
        [10, 0],
      ]);
      return replaceLink(model, {
        sourceLinkId: IDS.P1,
        newLink: redrawn,
        startNode: model.assets.get(IDS.J1) as NodeAsset,
        endNode: model.assets.get(IDS.J2) as NodeAsset,
        lengthUnit: "m",
        assetFactory,
        labelManager,
      });
    },
    expectApplied: ({ model }) => {
      expect(linkBetween(model, IDS.J1, IDS.J2)?.coordinates).toEqual([
        [0, 0],
        [3, 3],
        [7, 3],
        [10, 0],
      ]);
    },
  },
  {
    name: "replaceLink redrawing a pipe to another end node",
    fixture: aNetwork,
    run: ({ model, assetFactory, labelManager }) => {
      const redrawn = (model.assets.get(IDS.P1) as LinkAsset).copy();
      redrawn.setCoordinates([
        [0, 0],
        [10, 5],
        [20, 0],
      ]);
      return replaceLink(model, {
        sourceLinkId: IDS.P1,
        newLink: redrawn,
        startNode: model.assets.get(IDS.J1) as NodeAsset,
        endNode: model.assets.get(IDS.J3) as NodeAsset,
        lengthUnit: "m",
        assetFactory,
        labelManager,
      });
    },
    expectApplied: ({ model }) => {
      expect(linkBetween(model, IDS.J1, IDS.J2)).toBeUndefined();
      expect(linkBetween(model, IDS.J1, IDS.J3)?.coordinates).toEqual([
        [0, 0],
        [10, 5],
        [20, 0],
      ]);
    },
  },
];

const runCase = (testCase: OperationCase) => {
  const applied = testCase.fixture();
  const pristine = testCase.fixture();

  const moment = testCase.run(applied);
  const changeSet = toChangeSet(applied.model, moment);
  applyChangeSet(applied.model, changeSet, "forward", applied.labelManager);

  const probe = [...modelLabels(pristine.model), ...modelLabels(applied.model)];

  return { applied, pristine, changeSet, probe };
};

describe("change sets per operation", () => {
  it.each(cases)("$name", (testCase) => {
    const { applied, changeSet } = runCase(testCase);

    expect(changeSet.isEmpty).toBe(false);
    testCase.expectApplied(applied);
  });

  it.each(cases)("$name reverses back to the original", (testCase) => {
    const { applied, pristine, changeSet, probe } = runCase(testCase);

    applyChangeSet(applied.model, changeSet, "reverse", applied.labelManager);

    expect(withoutIndexOrder(snapshot(applied, probe))).toEqual(
      withoutIndexOrder(snapshot(pristine, probe)),
    );
  });
});
