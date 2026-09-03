import { describe, it, expect } from "vitest";
import type { AssetFactory } from "@epanet-js/hydraulic-model";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import {
  modelLabels,
  snapshot,
  withoutIndexOrder,
  type ModelFixture,
} from "src/__helpers__/model-snapshot";
import { applyMomentToModel } from "../mutations/apply-moment";
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
} from "../model-operations";
import { deactivateAssets } from "../model-operations/deactivate-assets";
import { reverseLink } from "../model-operations/reverse-link";
import { emptyCustomAttributesDefinition } from "@epanet-js/hydraulic-model";
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

type DifferentialCase = {
  name: string;
  fixture: () => Fixture;
  run: (fixture: Fixture) => ModelMoment;
};

const cases: DifferentialCase[] = [
  {
    name: "changeProperty",
    fixture: aNetwork,
    run: ({ model }) =>
      changeProperty(model, {
        assetIds: [IDS.P1],
        property: "diameter",
        value: 300,
      }),
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
  },
  {
    name: "changeLabel",
    fixture: aNetwork,
    run: ({ model }) =>
      changeLabel(model, { assetId: IDS.J1, newLabel: "RENAMED" }),
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
  },
  {
    name: "deleteAssets on a link",
    fixture: aNetwork,
    run: ({ model }) =>
      deleteAssets(model, {
        assetIds: [IDS.P1],
        shouldUpdateCustomerPoints: true,
      }),
  },
  {
    name: "deleteAssets on a node with links",
    fixture: aNetwork,
    run: ({ model }) =>
      deleteAssets(model, {
        assetIds: [IDS.J1],
        shouldUpdateCustomerPoints: true,
      }),
  },
  {
    name: "changeCurves",
    fixture: aNetwork,
    run: ({ model }) => {
      const curves = new Map(model.curves);
      curves.set(99, { id: 99, label: "C99", type: "volume", points: [] });
      return changeCurves(model, { curves });
    },
  },
  {
    name: "changeDemandAssignment",
    fixture: aNetwork,
    run: ({ model }) =>
      changeDemandAssignment(model, [
        { junctionId: IDS.J2, demands: [{ baseDemand: 7 }] },
      ]),
  },
  {
    name: "changeDemandAssignment on a customer point",
    fixture: aNetwork,
    run: ({ model }) =>
      changeDemandAssignment(model, [
        { customerPointId: IDS.CP1, demands: [{ baseDemand: 8 }] },
      ]),
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
  },
  {
    name: "deactivateAssets",
    fixture: aNetwork,
    run: ({ model }) => deactivateAssets(model, { assetIds: [IDS.P1] }),
  },
  {
    name: "reverseLink",
    fixture: aNetwork,
    run: ({ model }) => reverseLink(model, { linkId: IDS.P1 }),
  },
  {
    name: "moveCustomerPoint",
    fixture: aNetwork,
    run: ({ model }) =>
      moveCustomerPoint(model, {
        customerPointId: IDS.CP1,
        newCoordinates: [6, 2],
      }),
  },
  {
    name: "disconnectCustomers",
    fixture: aNetwork,
    run: ({ model }) =>
      disconnectCustomers(model, { customerPointIds: [IDS.CP1] }),
  },
  {
    name: "changeCustomerPointLabel",
    fixture: aNetwork,
    run: ({ model }) =>
      changeCustomerPointLabel(model, {
        customerPointId: IDS.CP1,
        newLabel: "CP-RENAMED",
      }),
  },
  {
    name: "removeCustomerPoints",
    fixture: aNetwork,
    run: ({ model }) =>
      removeCustomerPoints(model, { customerPointIds: [IDS.CP1] }),
  },
  {
    name: "changePatterns",
    fixture: aNetwork,
    run: ({ model }) => {
      const patterns = new Map(model.patterns);
      patterns.set(99, { id: 99, label: "P99", multipliers: [4, 5] });
      return changePatterns(model, patterns);
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
  },
  {
    name: "changeRawControls",
    fixture: aNetwork,
    run: ({ model }) =>
      changeRawControls(model, {
        simple: [{ template: "LINK 3 OPEN", assetReferences: [] }],
        rules: [],
      }),
  },
  {
    name: "changePipeMaterials",
    fixture: aNetwork,
    run: ({ model }) =>
      changePipeMaterials(model, [
        { label: "PVC", entries: [{ age: 0, roughness: 140 }] },
      ]),
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
  },
  {
    name: "deleteAssets on a pump, carrying its curve",
    fixture: aNetwork,
    run: ({ model }) => deleteAssets(model, { assetIds: [IDS.PU1] }),
  },
  {
    name: "deleteAssets on a valve",
    fixture: aNetwork,
    run: ({ model }) => deleteAssets(model, { assetIds: [IDS.V1] }),
  },
  {
    name: "deleteAssets on a reservoir",
    fixture: aNetwork,
    run: ({ model }) => deleteAssets(model, { assetIds: [IDS.R1] }),
  },
  {
    name: "changeCustomAttributesDefinition removing an attribute in use",
    fixture: aNetwork,
    run: ({ model }) =>
      changeCustomAttributesDefinition(
        model,
        emptyCustomAttributesDefinition(),
      ),
  },
];

const runCase = (testCase: DifferentialCase) => {
  const viaMoment = testCase.fixture();
  const viaChangeSet = testCase.fixture();
  const pristine = testCase.fixture();

  const moment = testCase.run(viaMoment);
  const changeSet = toChangeSet(viaChangeSet.model, moment);

  applyMomentToModel(viaMoment.model, moment, viaMoment.labelManager);
  applyChangeSet(
    viaChangeSet.model,
    changeSet,
    "forward",
    viaChangeSet.labelManager,
  );

  const probe = [
    ...modelLabels(pristine.model),
    ...modelLabels(viaMoment.model),
    ...modelLabels(viaChangeSet.model),
  ];

  return { viaMoment, viaChangeSet, pristine, changeSet, probe };
};

describe("change sets match the moment path", () => {
  it.each(cases)("$name", (testCase) => {
    const { viaMoment, viaChangeSet, changeSet, probe } = runCase(testCase);

    expect(changeSet.isEmpty).toBe(false);
    expect(withoutIndexOrder(snapshot(viaChangeSet, probe))).toEqual(
      withoutIndexOrder(snapshot(viaMoment, probe)),
    );
  });

  it.each(cases)("$name reverses back to the original", (testCase) => {
    const { viaChangeSet, pristine, changeSet, probe } = runCase(testCase);

    applyChangeSet(
      viaChangeSet.model,
      changeSet,
      "reverse",
      viaChangeSet.labelManager,
    );

    expect(withoutIndexOrder(snapshot(viaChangeSet, probe))).toEqual(
      withoutIndexOrder(snapshot(pristine, probe)),
    );
  });
});
