import { describe, it, expect } from "vitest";
import {
  buildTimedSetting,
  createEmptyRawControls,
  emptyCustomAttributesDefinition,
  setAssetControl,
  setAttributes,
  type Junction,
  type Pipe,
} from "@epanet-js/hydraulic-model";
import {
  assetsToRows,
  serializeControls,
  serializeCustomAttributesDefinition,
  serializePipeLibrary,
  serializeRawControls,
  toCustomerPointRow,
} from "@epanet-js/ejsdb-mappers";
import {
  buildChangeSetPayload,
  isEmptyApplyMomentPayload,
} from "@epanet-js/ejsdb";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
} from "src/__helpers__/hydraulic-model-builder";
import { buildTestFactories } from "src/__helpers__/test-factories";
import { CUSTOM_PROPERTY_PREFIX } from "@epanet-js/hydraulic-model";
import { CUSTOM_ATTRIBUTE_KEY_PREFIX } from "@epanet-js/ejsdb";
import { changeSet } from "src/hydraulic-model/change-sets/build";
import {
  dropAssets,
  dropCustomerPoints,
  putAssets,
  putCustomerPoints,
  replaceControls,
  replaceCurves,
  replaceCustomAttributes,
  replacePatterns,
  setAsset,
  setCustomerPoint,
  setDemands,
  setPipeLibrary,
  setRawControls,
} from "src/hydraulic-model/change-sets/intents";

const IDS = {
  J1: 1,
  J2: 2,
  J3: 3,
  P1: 4,
  CP1: 5,
  C1: 6,
  PAT1: 7,
  J4: 8,
  C2: 9,
  PAT2: 10,
} as const;

const aNetwork = () => {
  const { labelManager, assetFactory } = buildTestFactories();
  const model = HydraulicModelBuilder.with({ labelManager })
    .aJunction(IDS.J1, { coordinates: [0, 0], elevation: 10 })
    .aJunction(IDS.J2, { coordinates: [10, 0], elevation: 20 })
    .aJunction(IDS.J3, { coordinates: [20, 0], elevation: 30 })
    .aPipe(IDS.P1, {
      startNodeId: IDS.J1,
      endNodeId: IDS.J2,
      diameter: 200,
    })
    .aCurve({
      id: IDS.C1,
      type: "volume",
      label: "C1",
      points: [{ x: 1, y: 1 }],
    })
    .aPattern(IDS.PAT1, "PAT1", [1, 2, 3], "demand")
    .aCustomAttribute("junction", {
      id: "custom-1",
      label: "ZONE",
      type: "text",
    })
    .aCustomerPoint(IDS.CP1, {
      coordinates: [5, 1],
      connection: { pipeId: IDS.P1, junctionId: IDS.J1, snapPoint: [5, 0] },
    })
    .aJunctionDemand(IDS.J1, [{ baseDemand: 5 }])
    .aCustomerPointDemand(IDS.CP1, [{ baseDemand: 2 }])
    .build();

  for (const customerPoint of model.customerPoints.values()) {
    labelManager.register(
      customerPoint.label,
      "customerPoint",
      customerPoint.id,
    );
  }

  return { model, labelManager, assetFactory };
};

describe("buildChangeSetPayload assets", () => {
  it("writes a node create as a full row with the coordinates split", () => {
    const { model, assetFactory } = aNetwork();
    const junction = assetFactory.createJunction({
      id: IDS.J4,
      coordinates: [7, 9],
      elevation: 15,
    });

    const payload = buildChangeSetPayload(
      changeSet(model, "addNode", [putAssets([junction])]),
      "forward",
    );

    expect(payload.assetUpserts.junctions).toEqual(
      assetsToRows([junction]).junctions,
    );
    expect(payload.assetUpserts.junctions[0]).toMatchObject({
      id: IDS.J4,
      coord_x: 7,
      coord_y: 9,
      elevation: 15,
    });
    expect(payload.assetPatches.junctions).toEqual([]);
  });

  it("writes a link create with its connections and coords", () => {
    const { model, assetFactory } = aNetwork();
    const pipe = assetFactory.createPipe({
      id: IDS.J4,
      coordinates: [
        [10, 0],
        [20, 0],
      ],
      connections: [IDS.J2, IDS.J3],
      diameter: 150,
      roughness: 130,
      length: 10,
    });

    const payload = buildChangeSetPayload(
      changeSet(model, "addLink", [putAssets([pipe])]),
      "forward",
    );

    expect(payload.assetUpserts.pipes).toEqual(assetsToRows([pipe]).pipes);
    expect(payload.assetUpserts.pipes[0]).toMatchObject({
      id: IDS.J4,
      start_node_id: IDS.J2,
      end_node_id: IDS.J3,
      coords: JSON.stringify([
        [10, 0],
        [20, 0],
      ]),
    });
  });

  it("serializes a custom attribute into the create row", () => {
    const { model, assetFactory } = aNetwork();
    const junction = assetFactory.createJunction({
      id: IDS.J4,
      coordinates: [7, 9],
      elevation: 15,
    });
    junction.setProperty("custom-1", "NORTH");

    const payload = buildChangeSetPayload(
      changeSet(model, "addNode", [putAssets([junction])]),
      "forward",
    );

    expect(payload.assetUpserts.junctions[0].custom_attributes).toBe(
      JSON.stringify({ "custom-1": "NORTH" }),
    );
    expect(payload.customAttributeValues.junctions).toEqual([]);
  });

  it("writes a scalar change as a patch and nothing else", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "changeProperty", [setAsset(IDS.P1, { diameter: 300 })]),
      "forward",
    );

    expect(payload.assetPatches.pipes).toEqual([{ id: IDS.P1, diameter: 300 }]);
    expect(payload.assetUpserts.pipes).toEqual([]);
  });

  it("writes a node move as a coordinates patch", () => {
    const { model } = aNetwork();
    const moved = (model.assets.get(IDS.J1) as Junction).copy();
    moved.setCoordinates([3, 4]);

    const payload = buildChangeSetPayload(
      changeSet(model, "moveNode", [putAssets([moved])]),
      "forward",
    );

    expect(payload.assetPatches.junctions).toEqual([
      { id: IDS.J1, coord_x: 3, coord_y: 4 },
    ]);
  });

  it("writes a link reconnection as a connections patch", () => {
    const { model } = aNetwork();
    const reconnected = (model.assets.get(IDS.P1) as Pipe).copy();
    reconnected.setConnections(IDS.J2, IDS.J3);

    const payload = buildChangeSetPayload(
      changeSet(model, "reconnect", [putAssets([reconnected])]),
      "forward",
    );

    expect(payload.assetPatches.pipes).toEqual([
      { id: IDS.P1, start_node_id: IDS.J2, end_node_id: IDS.J3 },
    ]);
  });

  it("writes a link geometry change as a coords patch", () => {
    const { model } = aNetwork();
    const redrawn = (model.assets.get(IDS.P1) as Pipe).copy();
    redrawn.setCoordinates([
      [0, 0],
      [5, 5],
      [10, 0],
    ]);

    const payload = buildChangeSetPayload(
      changeSet(model, "redraw", [putAssets([redrawn])]),
      "forward",
    );

    expect(payload.assetPatches.pipes).toEqual([
      {
        id: IDS.P1,
        coords: JSON.stringify([
          [0, 0],
          [5, 5],
          [10, 0],
        ]),
      },
    ]);
  });

  it("writes a custom attribute change as a delta, not a column", () => {
    const { model } = aNetwork();
    model.assets.get(IDS.J1)!.setProperty("custom-1", "NORTH");

    const payload = buildChangeSetPayload(
      changeSet(model, "changeCustomAttribute", [
        setAsset(IDS.J1, { "custom-1": "SOUTH" }),
      ]),
      "forward",
    );

    expect(payload.assetPatches.junctions).toEqual([]);
    expect(payload.customAttributeValues.junctions).toEqual([
      { id: IDS.J1, delta: JSON.stringify({ "custom-1": "SOUTH" }) },
    ]);
  });

  it("writes a removed custom attribute as null in the delta", () => {
    const { model } = aNetwork();
    model.assets.get(IDS.J1)!.setProperty("custom-1", "NORTH");

    const payload = buildChangeSetPayload(
      changeSet(model, "removeCustomAttribute", [
        setAsset(IDS.J1, { "custom-1": undefined }),
      ]),
      "forward",
    );

    expect(payload.customAttributeValues.junctions).toEqual([
      { id: IDS.J1, delta: JSON.stringify({ "custom-1": null }) },
    ]);
  });

  it("writes nothing when the change touches no persisted column", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "hide", [setAsset(IDS.J1, { visibility: false })]),
      "forward",
    );

    expect(isEmptyApplyMomentPayload(payload)).toBe(true);
  });

  it("writes a delete as an id", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "deleteAssets", [dropAssets([IDS.P1])]),
      "forward",
    );

    expect(payload.assetDeleteIds).toEqual([IDS.P1]);
    expect(payload.assetUpserts.pipes).toEqual([]);
  });
});

describe("buildChangeSetPayload customer points", () => {
  it("writes a create with the four connection columns", () => {
    const { model } = aNetwork();
    const customerPoint = buildCustomerPoint(IDS.J4, { coordinates: [6, 2] });
    customerPoint.connect({
      pipeId: IDS.P1,
      junctionId: IDS.J2,
      snapPoint: [6, 0],
    });

    const payload = buildChangeSetPayload(
      changeSet(model, "addCustomerPoint", [
        putCustomerPoints([customerPoint]),
      ]),
      "forward",
    );

    expect(payload.customerPointUpserts).toEqual([
      toCustomerPointRow(customerPoint),
    ]);
    expect(payload.customerPointUpserts[0]).toMatchObject({
      pipe_id: IDS.P1,
      junction_id: IDS.J2,
      snap_x: 6,
      snap_y: 0,
    });
  });

  it("writes a disconnection as four explicit nulls", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "disconnect", [
        setCustomerPoint(IDS.CP1, { connection: null }),
      ]),
      "forward",
    );

    expect(payload.customerPointPatches).toEqual([
      {
        id: IDS.CP1,
        pipe_id: null,
        junction_id: null,
        snap_x: null,
        snap_y: null,
      },
    ]);
  });

  it("drops a demand update for a customer point being deleted", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "removeCustomerPoints", [
        dropCustomerPoints([IDS.CP1]),
        setDemands([{ customerPointId: IDS.CP1, demands: [] }]),
      ]),
      "forward",
    );

    expect(payload.customerPointDeleteIds).toEqual([IDS.CP1]);
    expect(payload.customerPointDemandUpdates).toEqual([]);
  });
});

describe("buildChangeSetPayload curves and patterns", () => {
  it("writes a curve create as an upsert with stringified points", () => {
    const { model } = aNetwork();
    const curves = new Map(model.curves);
    curves.set(IDS.C2, {
      id: IDS.C2,
      label: "C2",
      type: "volume",
      points: [{ x: 1, y: 2 }],
    });

    const payload = buildChangeSetPayload(
      changeSet(model, "changeCurves", [replaceCurves(curves)]),
      "forward",
    );

    expect(payload.curveUpserts).toEqual([
      {
        id: IDS.C2,
        label: "C2",
        type: "volume",
        points: JSON.stringify([{ x: 1, y: 2 }]),
      },
    ]);
    expect(payload.curvePatches).toEqual([]);
  });

  it("writes a points-only curve edit as a patch", () => {
    const { model } = aNetwork();
    const curves = new Map(model.curves);
    const existing = curves.get(IDS.C1)!;
    curves.set(IDS.C1, { ...existing, points: [{ x: 2, y: 3 }] });

    const payload = buildChangeSetPayload(
      changeSet(model, "changeCurves", [replaceCurves(curves)]),
      "forward",
    );

    expect(payload.curvePatches).toEqual([
      { id: IDS.C1, points: JSON.stringify([{ x: 2, y: 3 }]) },
    ]);
    expect(payload.curveUpserts).toEqual([]);
  });

  it("writes a curve removal as a delete id", () => {
    const { model } = aNetwork();
    const curves = new Map(model.curves);
    curves.delete(IDS.C1);

    const payload = buildChangeSetPayload(
      changeSet(model, "changeCurves", [replaceCurves(curves)]),
      "forward",
    );

    expect(payload.curveDeleteIds).toEqual([IDS.C1]);
  });

  it("writes a pattern create as an upsert with stringified multipliers", () => {
    const { model } = aNetwork();
    const patterns = new Map(model.patterns);
    patterns.set(IDS.PAT2, {
      id: IDS.PAT2,
      label: "PAT2",
      type: "demand",
      multipliers: [0.5, 1.5],
    });

    const payload = buildChangeSetPayload(
      changeSet(model, "changePatterns", [replacePatterns(patterns)]),
      "forward",
    );

    expect(payload.patternUpserts).toEqual([
      {
        id: IDS.PAT2,
        label: "PAT2",
        type: "demand",
        multipliers: JSON.stringify([0.5, 1.5]),
      },
    ]);
  });

  it("writes a multipliers-only pattern edit as a patch", () => {
    const { model } = aNetwork();
    const patterns = new Map(model.patterns);
    const existing = patterns.get(IDS.PAT1)!;
    patterns.set(IDS.PAT1, { ...existing, multipliers: [4, 5] });

    const payload = buildChangeSetPayload(
      changeSet(model, "changePatterns", [replacePatterns(patterns)]),
      "forward",
    );

    expect(payload.patternPatches).toEqual([
      { id: IDS.PAT1, multipliers: JSON.stringify([4, 5]) },
    ]);
  });

  it("writes a pattern removal as a delete id", () => {
    const { model } = aNetwork();
    const patterns = new Map(model.patterns);
    patterns.delete(IDS.PAT1);

    const payload = buildChangeSetPayload(
      changeSet(model, "changePatterns", [replacePatterns(patterns)]),
      "forward",
    );

    expect(payload.patternDeleteIds).toEqual([IDS.PAT1]);
  });
});

describe("buildChangeSetPayload demands and singletons", () => {
  it("writes demands with their ordinals", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "changeDemandAssignment", [
        setDemands([
          {
            junctionId: IDS.J2,
            demands: [
              { baseDemand: 7, patternId: IDS.PAT1 },
              { baseDemand: 1 },
            ],
          },
        ]),
      ]),
      "forward",
    );

    expect(payload.junctionDemandUpdates).toEqual([
      {
        junctionId: IDS.J2,
        demands: [
          {
            junction_id: IDS.J2,
            ordinal: 0,
            base_demand: 7,
            pattern_id: IDS.PAT1,
          },
          { junction_id: IDS.J2, ordinal: 1, base_demand: 1, pattern_id: null },
        ],
      },
    ]);
  });

  it("writes a cleared demand list as an empty update", () => {
    const { model } = aNetwork();

    const payload = buildChangeSetPayload(
      changeSet(model, "changeDemandAssignment", [
        setDemands([{ junctionId: IDS.J1, demands: [] }]),
      ]),
      "forward",
    );

    expect(payload.junctionDemandUpdates).toEqual([
      { junctionId: IDS.J1, demands: [] },
    ]);
  });

  it("writes the pipe library as a serialized string", () => {
    const { model } = aNetwork();
    const materials = [{ label: "PVC", entries: [{ age: 0, roughness: 140 }] }];

    const payload = buildChangeSetPayload(
      changeSet(model, "changePipeMaterials", [setPipeLibrary(materials)]),
      "forward",
    );

    expect(payload.pipeLibraryReplacement).toBe(
      serializePipeLibrary(materials),
    );
  });

  it("writes the raw controls as a serialized string", () => {
    const { model } = aNetwork();
    const rawControls = {
      ...createEmptyRawControls(),
      simple: [
        {
          template: "LINK 4 OPEN AT TIME 5",
          assetReferences: [{ assetId: IDS.P1, isActionTarget: true }],
        },
      ],
    };

    const payload = buildChangeSetPayload(
      changeSet(model, "changeRawControls", [setRawControls(rawControls)]),
      "forward",
    );

    expect(payload.rawControlsReplacement).toBe(
      serializeRawControls(rawControls),
    );
  });

  it("writes the controls as a serialized string", () => {
    const { model } = aNetwork();
    const controls = setAssetControl(
      model.controls,
      IDS.P1,
      buildTimedSetting(IDS.P1, [{ time: 5, status: "on", setting: 2 }]),
    );

    const payload = buildChangeSetPayload(
      changeSet(model, "changeAssetControl", [replaceControls(controls)]),
      "forward",
    );

    expect(payload.controlsReplacement).toBe(serializeControls(controls));
  });

  it("writes the custom attributes definition un-flattened", () => {
    const { model } = aNetwork();
    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "junction",
      [{ id: "custom-2", label: "DMA", type: "text" }],
    );

    const payload = buildChangeSetPayload(
      changeSet(model, "changeCustomAttributesDefinition", [
        replaceCustomAttributes(definition),
      ]),
      "forward",
    );

    expect(payload.customAttributesDefinition).toBe(
      serializeCustomAttributesDefinition(definition),
    );
  });
});

describe("buildChangeSetPayload direction", () => {
  it("reverses a create into a delete", () => {
    const { model, assetFactory } = aNetwork();
    const junction = assetFactory.createJunction({
      id: IDS.J4,
      coordinates: [7, 9],
      elevation: 15,
    });
    const built = changeSet(model, "addNode", [putAssets([junction])]);

    const payload = buildChangeSetPayload(built, "reverse");

    expect(payload.assetDeleteIds).toEqual([IDS.J4]);
    expect(payload.assetUpserts.junctions).toEqual([]);
  });

  it("reverses a delete into the full row it had", () => {
    const { model } = aNetwork();
    const junction = model.assets.get(IDS.J1) as Junction;
    const built = changeSet(model, "deleteAssets", [dropAssets([IDS.J1])]);

    const payload = buildChangeSetPayload(built, "reverse");

    expect(payload.assetUpserts.junctions).toEqual(
      assetsToRows([junction]).junctions,
    );
    expect(payload.assetDeleteIds).toEqual([]);
  });

  it("reverses an update back to the before value", () => {
    const { model } = aNetwork();
    const built = changeSet(model, "changeProperty", [
      setAsset(IDS.P1, { diameter: 300 }),
    ]);

    const payload = buildChangeSetPayload(built, "reverse");

    expect(payload.assetPatches.pipes).toEqual([{ id: IDS.P1, diameter: 200 }]);
  });
});

describe("validation rejects at build, not at payload", () => {
  it("throws on a non-finite node elevation create", () => {
    const { model, assetFactory } = aNetwork();
    const junction = assetFactory.createJunction({
      id: IDS.J4,
      coordinates: [7, 9],
      elevation: 15,
    });
    junction.setElevation(NaN);

    expect(() =>
      changeSet(model, "addNode", [putAssets([junction])]),
    ).toThrow();
  });

  it("throws on a non-finite pipe diameter patch", () => {
    const { model } = aNetwork();

    expect(() =>
      changeSet(model, "changeProperty", [setAsset(IDS.P1, { diameter: NaN })]),
    ).toThrow();
  });

  it("throws on a non-finite demand", () => {
    const { model } = aNetwork();

    expect(() =>
      changeSet(model, "changeDemandAssignment", [
        setDemands([{ junctionId: IDS.J2, demands: [{ baseDemand: NaN }] }]),
      ]),
    ).toThrow();
  });
});

describe("custom attribute key prefix", () => {
  it("matches the model's custom property prefix", () => {
    expect(CUSTOM_ATTRIBUTE_KEY_PREFIX).toBe(CUSTOM_PROPERTY_PREFIX);
  });
});
