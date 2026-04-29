import { describe, expect, it } from "vitest";
import {
  HydraulicModelBuilder,
  buildCustomerPoint,
  buildJunction,
  buildPipe,
  buildReservoir,
} from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "src/lib/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import type { HydraulicModel } from "src/hydraulic-model";
import { applyMomentToDb } from "./apply-moment";
import { fetchProject } from "./fetch-project";
import { importProject } from "./import-project";
import { useInProcessDb } from "../__test-helpers__/in-process-db";

const seed = (hydraulicModel: HydraulicModel) =>
  importProject({
    newDb: true,
    hydraulicModel,
    projectSettings: defaultProjectSettings,
    simulationSettings: defaultSimulationSettings,
  });

describe("apply-moment integration", () => {
  useInProcessDb();

  it("upserts new assets via putAssets", async () => {
    const IDS = { J1: 1, J2: 2, R1: 3, P1: 4 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .build(),
    );

    const moment: ModelMoment = {
      note: "add assets",
      putAssets: [
        buildJunction({
          id: IDS.J2,
          label: "J2",
          coordinates: [10, 0],
          elevation: 20,
        }),
        buildReservoir({
          id: IDS.R1,
          label: "R1",
          coordinates: [20, 0],
          elevation: 100,
        }),
        buildPipe({
          id: IDS.P1,
          label: "P1",
          connections: [IDS.J1, IDS.J2],
          coordinates: [
            [0, 0],
            [10, 0],
          ],
          diameter: 150,
          length: 200,
        }),
      ],
    };

    await applyMomentToDb(moment);

    const project = await fetchProject();
    expect(project.hydraulicModel.assets.size).toBe(4);

    const j2 = project.hydraulicModel.assets.get(IDS.J2) as Junction;
    expect(j2.type).toBe("junction");
    expect(j2.label).toBe("J2");
    expect(j2.elevation).toBe(20);

    const pipe = project.hydraulicModel.assets.get(IDS.P1) as Pipe;
    expect(pipe.type).toBe("pipe");
    expect(pipe.diameter).toBe(150);
    expect(pipe.length).toBe(200);
    expect(pipe.connections).toEqual([IDS.J1, IDS.J2]);
  });

  it("updates partial properties via patchAssetsAttributes", async () => {
    const IDS = { J1: 1 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1", elevation: 10 })
        .build(),
    );

    const moment: ModelMoment = {
      note: "patch elevation",
      patchAssetsAttributes: [
        {
          id: IDS.J1,
          type: "junction",
          properties: { elevation: 50 },
        },
      ],
    };

    await applyMomentToDb(moment);

    const project = await fetchProject();
    const j1 = project.hydraulicModel.assets.get(IDS.J1) as Junction;
    expect(j1.elevation).toBe(50);
    expect(j1.label).toBe("J1");
  });

  it("patches a pipe boolean property through to the fetched asset", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build(),
    );

    const moment: ModelMoment = {
      note: "deactivate pipe",
      patchAssetsAttributes: [
        {
          id: IDS.P1,
          type: "pipe",
          properties: { isActive: false },
        },
      ],
    };

    await applyMomentToDb(moment);

    const project = await fetchProject();
    const pipe = project.hydraulicModel.assets.get(IDS.P1) as Pipe;
    expect(pipe.isActive).toBe(false);
  });

  it("removes assets via deleteAssets", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build(),
    );

    await applyMomentToDb({
      note: "delete pipe",
      deleteAssets: [IDS.P1],
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.assets.size).toBe(2);
    expect(project.hydraulicModel.assets.get(IDS.P1)).toBeUndefined();
  });

  it("upserts customer points via putCustomerPoints", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 10, CP2: 11 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { coordinates: [0, 0] })
        .aJunction(IDS.J2, { coordinates: [10, 0] })
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build(),
    );

    const disconnected = buildCustomerPoint(IDS.CP1, {
      coordinates: [1, 1],
      label: "CP1",
    });
    const connected = buildCustomerPoint(IDS.CP2, {
      coordinates: [5, 0.5],
      label: "CP2",
    });
    connected.connect({
      pipeId: IDS.P1,
      junctionId: IDS.J2,
      snapPoint: [5, 0],
    });

    await applyMomentToDb({
      note: "add customer points",
      putCustomerPoints: [disconnected, connected],
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.customerPoints.size).toBe(2);

    const cp1 = project.hydraulicModel.customerPoints.get(IDS.CP1);
    expect(cp1?.label).toBe("CP1");
    expect(cp1?.coordinates).toEqual([1, 1]);
    expect(cp1?.connection).toBeNull();

    const cp2 = project.hydraulicModel.customerPoints.get(IDS.CP2);
    expect(cp2?.label).toBe("CP2");
    expect(cp2?.connection?.pipeId).toBe(IDS.P1);
    expect(cp2?.connection?.junctionId).toBe(IDS.J2);
  });

  it("removes customer points via deleteCustomerPoints", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 10, CP2: 11 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, { coordinates: [1, 1], label: "CP1" })
        .aCustomerPoint(IDS.CP2, { coordinates: [2, 2], label: "CP2" })
        .build(),
    );

    await applyMomentToDb({
      note: "delete cp1",
      deleteCustomerPoints: [IDS.CP1],
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.customerPoints.size).toBe(1);
    expect(project.hydraulicModel.customerPoints.get(IDS.CP1)).toBeUndefined();
    expect(project.hydraulicModel.customerPoints.get(IDS.CP2)).toBeDefined();
  });

  it("assigns junction demands via putDemands", async () => {
    const IDS = { J1: 1, PT1: 5 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aDemandPattern(IDS.PT1, "daily", [1, 0.8])
        .build(),
    );

    await applyMomentToDb({
      note: "assign junction demand",
      putDemands: {
        assignments: [
          {
            junctionId: IDS.J1,
            demands: [{ baseDemand: 2.5, patternId: IDS.PT1 }],
          },
        ],
      },
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.demands.junctions.get(IDS.J1)).toEqual([
      { baseDemand: 2.5, patternId: IDS.PT1 },
    ]);
  });

  it("assigns customer point demands via putDemands", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3, CP1: 10, PT1: 5 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .aCustomerPoint(IDS.CP1, {
          coordinates: [1, 1],
          label: "CP1",
          connection: { pipeId: IDS.P1, junctionId: IDS.J2 },
        })
        .aDemandPattern(IDS.PT1, "daily", [1, 1.2])
        .build(),
    );

    await applyMomentToDb({
      note: "assign cp demand",
      putDemands: {
        assignments: [
          {
            customerPointId: IDS.CP1,
            demands: [{ baseDemand: 5, patternId: IDS.PT1 }],
          },
        ],
      },
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.demands.customerPoints.get(IDS.CP1)).toEqual([
      { baseDemand: 5, patternId: IDS.PT1 },
    ]);
  });

  it("clears junction demands when an empty assignment is provided", async () => {
    const IDS = { J1: 1, PT1: 5 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aDemandPattern(IDS.PT1, "daily", [1])
        .aJunctionDemand(IDS.J1, [{ baseDemand: 3, patternId: IDS.PT1 }])
        .build(),
    );

    await applyMomentToDb({
      note: "clear junction demands",
      putDemands: {
        assignments: [{ junctionId: IDS.J1, demands: [] }],
      },
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.demands.junctions.get(IDS.J1) ?? []).toEqual(
      [],
    );
  });

  it("replaces patterns via putPatterns", async () => {
    const IDS = { PT1: 1, PT2: 2 } as const;

    await seed(
      HydraulicModelBuilder.with().aDemandPattern(IDS.PT1, "old", [1]).build(),
    );

    await applyMomentToDb({
      note: "replace patterns",
      putPatterns: new Map([
        [
          IDS.PT2,
          {
            id: IDS.PT2,
            label: "weekly",
            type: "demand",
            multipliers: [0.5, 1, 1.5],
          },
        ],
      ]),
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.patterns.size).toBe(1);
    expect(project.hydraulicModel.patterns.get(IDS.PT1)).toBeUndefined();
    const pt2 = project.hydraulicModel.patterns.get(IDS.PT2);
    expect(pt2?.label).toBe("weekly");
    expect(pt2?.type).toBe("demand");
    expect(pt2?.multipliers).toEqual([0.5, 1, 1.5]);
  });

  it("replaces curves via putCurves", async () => {
    const IDS = { C1: 1, C2: 2 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aPumpCurve({ id: IDS.C1, points: [{ x: 1, y: 1 }] })
        .build(),
    );

    await applyMomentToDb({
      note: "replace curves",
      putCurves: new Map([
        [
          IDS.C2,
          {
            id: IDS.C2,
            label: "head",
            type: "pump",
            points: [
              { x: 0, y: 100 },
              { x: 50, y: 0 },
            ],
          },
        ],
      ]),
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.curves.size).toBe(1);
    expect(project.hydraulicModel.curves.get(IDS.C1)).toBeUndefined();
    const c2 = project.hydraulicModel.curves.get(IDS.C2);
    expect(c2?.type).toBe("pump");
    expect(c2?.points).toEqual([
      { x: 0, y: 100 },
      { x: 50, y: 0 },
    ]);
  });

  it("replaces controls via putControls", async () => {
    const IDS = { J1: 1, J2: 2, P1: 3 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aPipe(IDS.P1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build(),
    );

    await applyMomentToDb({
      note: "replace controls",
      putControls: {
        simple: [
          {
            template: "LINK {{0}} OPEN IF NODE {{1}} BELOW 5",
            assetReferences: [
              { assetId: IDS.P1, isActionTarget: true },
              { assetId: IDS.J1, isActionTarget: false },
            ],
          },
        ],
        rules: [
          {
            ruleId: "R1",
            template: "RULE R1\nIF NODE {{0}} LEVEL > 5",
            assetReferences: [{ assetId: IDS.J2, isActionTarget: false }],
          },
        ],
      },
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.controls.simple).toHaveLength(1);
    expect(project.hydraulicModel.controls.simple[0]).toEqual({
      template: "LINK {{0}} OPEN IF NODE {{1}} BELOW 5",
      assetReferences: [
        { assetId: IDS.P1, isActionTarget: true },
        { assetId: IDS.J1, isActionTarget: false },
      ],
    });
    expect(project.hydraulicModel.controls.rules).toHaveLength(1);
    expect(project.hydraulicModel.controls.rules[0]).toEqual({
      ruleId: "R1",
      template: "RULE R1\nIF NODE {{0}} LEVEL > 5",
      assetReferences: [{ assetId: IDS.J2, isActionTarget: false }],
    });
  });

  it("does not change DB state for a noop moment", async () => {
    const IDS = { J1: 1 } as const;

    await seed(
      HydraulicModelBuilder.with()
        .aJunction(IDS.J1, { label: "J1", elevation: 7 })
        .build(),
    );

    await applyMomentToDb({ note: "noop" });

    const project = await fetchProject();
    expect(project.hydraulicModel.assets.size).toBe(1);
    const j1 = project.hydraulicModel.assets.get(IDS.J1) as Junction;
    expect(j1.elevation).toBe(7);
    expect(j1.label).toBe("J1");
  });
});
