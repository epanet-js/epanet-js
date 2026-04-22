import { presets } from "src/lib/project-settings/quantities-spec";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { initializeHydraulicModel } from "src/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import { buildMomentPayload } from "./apply-moment";

const setupModel = (): {
  model: HydraulicModel;
  factories: ReturnType<typeof initializeModelFactories>;
} => {
  const idGenerator = new ConsecutiveIdsGenerator();
  const labelManager = new LabelManager();
  const factories = initializeModelFactories({
    idGenerator,
    labelManager,
    defaults: presets.LPS.defaults,
  });
  const model = initializeHydraulicModel({ idGenerator });
  return { model, factories };
};

describe("buildMomentPayload", () => {
  it("returns empty payload for an empty moment", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload({ note: "noop" }, model);

    expect(payload.assetDeleteIds).toEqual([]);
    expect(payload.assetUpserts.junctions).toEqual([]);
    expect(payload.assetUpserts.pipes).toEqual([]);
  });

  it("collects putAssets into upserts bucketed by type", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
      coordinates: [0, 0],
    });
    const pipe = factories.assetFactory.createPipe({
      id: 2,
      label: "P1",
      connections: [1, 1],
      coordinates: [
        [0, 0],
        [1, 0],
      ],
    });
    model.assets.set(junction.id, junction);
    model.assets.set(pipe.id, pipe);

    const moment: ModelMoment = {
      note: "add",
      putAssets: [junction, pipe],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.assetUpserts.junctions).toHaveLength(1);
    expect(payload.assetUpserts.junctions[0].id).toBe(1);
    expect(payload.assetUpserts.pipes).toHaveLength(1);
    expect(payload.assetUpserts.pipes[0].id).toBe(2);
  });

  it("refetches patched assets from the post-apply model for full-row upsert", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
      coordinates: [0, 0],
      elevation: 42,
    });
    model.assets.set(junction.id, junction);

    const moment: ModelMoment = {
      note: "edit",
      patchAssetsAttributes: [
        {
          id: 1,
          type: "junction",
          properties: { elevation: 100 },
        },
      ],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.assetUpserts.junctions).toHaveLength(1);
    expect(payload.assetUpserts.junctions[0].id).toBe(1);
    expect(payload.assetUpserts.junctions[0].elevation).toBe(42);
  });

  it("deduplicates an asset that appears in both putAssets and patchAssetsAttributes", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
    });
    model.assets.set(junction.id, junction);

    const moment: ModelMoment = {
      note: "dup",
      putAssets: [junction],
      patchAssetsAttributes: [
        {
          id: 1,
          type: "junction",
          properties: { elevation: 10 },
        },
      ],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.assetUpserts.junctions).toHaveLength(1);
  });

  it("forwards deleteAssets ids", () => {
    const { model } = setupModel();

    const moment: ModelMoment = {
      note: "del",
      deleteAssets: [3, 7, 11],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.assetDeleteIds).toEqual([3, 7, 11]);
  });

  it("skips assets that were deleted and are not in the post-apply model", () => {
    const { model, factories } = setupModel();
    const junction = factories.assetFactory.createJunction({
      id: 1,
      label: "J1",
    });

    const moment: ModelMoment = {
      note: "patch on deleted",
      patchAssetsAttributes: [
        {
          id: junction.id,
          type: "junction",
          properties: { elevation: 99 },
        },
      ],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.assetUpserts.junctions).toEqual([]);
  });

  it("serializes putCustomerPoints into customer point upserts", () => {
    const { model, factories } = setupModel();
    const disconnected = factories.customerPointFactory.create([1, 2], "CP1");
    const connected = factories.customerPointFactory.create([3, 4], "CP2");
    connected.connect({
      pipeId: 10,
      junctionId: 20,
      snapPoint: [3.5, 4.5],
    });

    const moment: ModelMoment = {
      note: "add cps",
      putCustomerPoints: [disconnected, connected],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.customerPointUpserts).toHaveLength(2);
    expect(payload.customerPointUpserts[0]).toEqual({
      id: disconnected.id,
      label: "CP1",
      coord_x: 1,
      coord_y: 2,
      pipe_id: null,
      junction_id: null,
      snap_x: null,
      snap_y: null,
    });
    expect(payload.customerPointUpserts[1]).toEqual({
      id: connected.id,
      label: "CP2",
      coord_x: 3,
      coord_y: 4,
      pipe_id: 10,
      junction_id: 20,
      snap_x: 3.5,
      snap_y: 4.5,
    });
  });

  it("forwards deleteCustomerPoints ids", () => {
    const { model } = setupModel();

    const moment: ModelMoment = {
      note: "delete cps",
      deleteCustomerPoints: [4, 8],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.customerPointDeleteIds).toEqual([4, 8]);
  });

  it("skips customer point upserts for ids that were deleted in the same moment", () => {
    const { model, factories } = setupModel();
    const cp = factories.customerPointFactory.create([0, 0], "CP1");

    const moment: ModelMoment = {
      note: "upsert then delete same cp",
      putCustomerPoints: [cp],
      deleteCustomerPoints: [cp.id],
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.customerPointDeleteIds).toEqual([cp.id]);
    expect(payload.customerPointUpserts).toEqual([]);
  });

  it("serializes customer point demand assignments with ordinals", () => {
    const { model } = setupModel();

    const moment: ModelMoment = {
      note: "assign demands",
      putDemands: {
        assignments: [
          {
            customerPointId: 7,
            demands: [
              { baseDemand: 2, patternId: 99 },
              { baseDemand: 5, patternId: undefined },
            ],
          },
        ],
      },
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.customerPointDemandUpdates).toHaveLength(1);
    expect(payload.customerPointDemandUpdates[0]).toEqual({
      customerPointId: 7,
      demands: [
        {
          customer_point_id: 7,
          ordinal: 0,
          base_demand: 2,
          pattern_id: 99,
        },
        {
          customer_point_id: 7,
          ordinal: 1,
          base_demand: 5,
          pattern_id: null,
        },
      ],
    });
  });

  it("serializes junction demand assignments with ordinals", () => {
    const { model } = setupModel();
    const IDS = { J1: 3 } as const;

    const moment: ModelMoment = {
      note: "junction demands",
      putDemands: {
        assignments: [
          {
            junctionId: IDS.J1,
            demands: [
              { baseDemand: 1, patternId: 42 },
              { baseDemand: 2.5, patternId: undefined },
            ],
          },
        ],
      },
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.junctionDemandUpdates).toHaveLength(1);
    expect(payload.junctionDemandUpdates[0]).toEqual({
      junctionId: IDS.J1,
      demands: [
        {
          junction_id: IDS.J1,
          ordinal: 0,
          base_demand: 1,
          pattern_id: 42,
        },
        {
          junction_id: IDS.J1,
          ordinal: 1,
          base_demand: 2.5,
          pattern_id: null,
        },
      ],
    });
    expect(payload.customerPointDemandUpdates).toEqual([]);
  });

  it("emits an empty-demands junction update to clear a junction's demands", () => {
    const { model } = setupModel();
    const IDS = { J1: 3 } as const;

    const moment: ModelMoment = {
      note: "clear demands",
      putDemands: {
        assignments: [{ junctionId: IDS.J1, demands: [] }],
      },
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.junctionDemandUpdates).toEqual([
      { junctionId: IDS.J1, demands: [] },
    ]);
  });

  it("serializes putPatterns into a full-replacement payload", () => {
    const { model } = setupModel();
    const IDS = { P1: 1, P2: 2 } as const;

    const moment: ModelMoment = {
      note: "patterns",
      putPatterns: new Map([
        [
          IDS.P1,
          {
            id: IDS.P1,
            label: "DailyUrban",
            type: "demand",
            multipliers: [0.5, 1, 1.5],
          },
        ],
        [
          IDS.P2,
          {
            id: IDS.P2,
            label: "NoType",
            multipliers: [1],
          },
        ],
      ]),
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.patternsReplacement).toEqual([
      {
        id: IDS.P1,
        label: "DailyUrban",
        type: "demand",
        multipliers: JSON.stringify([0.5, 1, 1.5]),
      },
      {
        id: IDS.P2,
        label: "NoType",
        type: null,
        multipliers: JSON.stringify([1]),
      },
    ]);
  });

  it("sets patternsReplacement to null when moment has no putPatterns", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload({ note: "noop" }, model);

    expect(payload.patternsReplacement).toBeNull();
  });

  it("treats an empty putPatterns map as a full-clear", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload(
      { note: "clear patterns", putPatterns: new Map() },
      model,
    );

    expect(payload.patternsReplacement).toEqual([]);
  });

  it("serializes putCurves into a full-replacement payload", () => {
    const { model } = setupModel();
    const IDS = { C1: 1, C2: 2 } as const;

    const moment: ModelMoment = {
      note: "curves",
      putCurves: new Map([
        [
          IDS.C1,
          {
            id: IDS.C1,
            label: "Head",
            type: "pump",
            points: [
              { x: 0, y: 100 },
              { x: 50, y: 0 },
            ],
          },
        ],
        [
          IDS.C2,
          {
            id: IDS.C2,
            label: "Loose",
            points: [{ x: 1, y: 2 }],
          },
        ],
      ]),
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.curvesReplacement).toEqual([
      {
        id: IDS.C1,
        label: "Head",
        type: "pump",
        points: JSON.stringify([
          { x: 0, y: 100 },
          { x: 50, y: 0 },
        ]),
      },
      {
        id: IDS.C2,
        label: "Loose",
        type: null,
        points: JSON.stringify([{ x: 1, y: 2 }]),
      },
    ]);
  });

  it("sets curvesReplacement to null when moment has no putCurves", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload({ note: "noop" }, model);

    expect(payload.curvesReplacement).toBeNull();
  });

  it("treats an empty putCurves map as a full-clear", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload(
      { note: "clear curves", putCurves: new Map() },
      model,
    );

    expect(payload.curvesReplacement).toEqual([]);
  });

  it("serializes putControls into a JSON blob", () => {
    const { model } = setupModel();
    const IDS = { A1: 1, A2: 2 } as const;

    const putControls = {
      simple: [
        {
          template: "LINK {{0}} OPEN IF NODE {{1}} BELOW 5",
          assetReferences: [
            { assetId: IDS.A1, isActionTarget: true },
            { assetId: IDS.A2, isActionTarget: false },
          ],
        },
      ],
      rules: [
        {
          ruleId: "R1",
          template: "RULE R1\nIF NODE {{0}} LEVEL > 5",
          assetReferences: [{ assetId: IDS.A2, isActionTarget: false }],
        },
      ],
    };

    const payload = buildMomentPayload(
      { note: "controls", putControls },
      model,
    );

    expect(payload.controlsReplacement).not.toBeNull();
    expect(JSON.parse(payload.controlsReplacement!)).toEqual(putControls);
  });

  it("sets controlsReplacement to null when moment has no putControls", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload({ note: "noop" }, model);

    expect(payload.controlsReplacement).toBeNull();
  });

  it("serializes empty controls as an empty-arrays blob", () => {
    const { model } = setupModel();

    const payload = buildMomentPayload(
      {
        note: "clear controls",
        putControls: { simple: [], rules: [] },
      },
      model,
    );

    expect(JSON.parse(payload.controlsReplacement!)).toEqual({
      simple: [],
      rules: [],
    });
  });

  it("skips demand assignments for customer points being deleted", () => {
    const { model } = setupModel();

    const moment: ModelMoment = {
      note: "clear demands on deletion",
      deleteCustomerPoints: [7],
      putDemands: {
        assignments: [{ customerPointId: 7, demands: [] }],
      },
    };

    const payload = buildMomentPayload(moment, model);

    expect(payload.customerPointDeleteIds).toEqual([7]);
    expect(payload.customerPointDemandUpdates).toEqual([]);
  });
});
