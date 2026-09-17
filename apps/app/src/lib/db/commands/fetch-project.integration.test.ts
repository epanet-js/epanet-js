import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import {
  defaultSimulationSettings,
  type SimulationSettings,
} from "src/simulation/simulation-settings";
import type { ProjectSettings } from "@epanet-js/project-settings";
import {
  type Junction,
  type Reservoir,
  type Pipe,
} from "@epanet-js/hydraulic-model";
import { fetchProject } from "./fetch-project";
import { importProject } from "./import-project";
import { saveCustomAttributes } from "./save-custom-attributes";
import {
  emptyCustomAttributesDefinition,
  getAttributes,
  setAttributes,
} from "@epanet-js/hydraulic-model";
import { useInProcessDb } from "../__test-helpers__/in-process-db";
import type { MultiPolygon } from "geojson";
import type { BBox } from "@turf/helpers";

describe("fetch-project integration", () => {
  useInProcessDb();

  it("round-trips a project through importProject -> fetchProject", async () => {
    const projectSettings: ProjectSettings = {
      ...defaultProjectSettings,
      name: "round-trip test",
    };
    const simulationSettings: SimulationSettings = {
      ...defaultSimulationSettings,
      globalDemandMultiplier: 1.25,
    };

    const hydraulicModel = HydraulicModelBuilder.with()
      .aJunction(1, { label: "J1", elevation: 10 })
      .aJunction(2, { label: "J2", elevation: 20 })
      .aReservoir(3, { label: "R1", elevation: 100 })
      .aPipe(4, {
        label: "P1",
        startNodeId: 1,
        endNodeId: 2,
        diameter: 150,
        length: 200,
      })
      .aPipe(5, {
        label: "P2",
        startNodeId: 3,
        endNodeId: 1,
        diameter: 200,
        length: 50,
      })
      .aDemandPattern(6, "daily", [1, 0.8, 1.2, 0.9])
      .aPumpCurve({
        id: 7,
        points: [
          { x: 0, y: 50 },
          { x: 10, y: 30 },
        ],
      })
      .aCustomerPoint(8, {
        coordinates: [0.5, 0.5],
        label: "CP1",
        connection: { pipeId: 4, junctionId: 2 },
      })
      .aCustomerPointDemand(8, [{ baseDemand: 5, patternId: 6 }])
      .aJunctionDemand(1, [{ baseDemand: 2.5, patternId: 6 }])
      .build();

    await importProject({
      newDb: true,
      hydraulicModel,
      projectSettings,
      simulationSettings,
    });

    const project = await fetchProject();

    expect(project.projectSettings.name).toBe("round-trip test");
    expect(project.simulationSettings.globalDemandMultiplier).toBe(1.25);

    expect(project.hydraulicModel.assets.size).toBe(5);
    const j1 = project.hydraulicModel.assets.get(1) as Junction;
    expect(j1.type).toBe("junction");
    expect(j1.label).toBe("J1");
    expect(j1.elevation).toBe(10);

    const reservoir = project.hydraulicModel.assets.get(3) as Reservoir;
    expect(reservoir.type).toBe("reservoir");
    expect(reservoir.elevation).toBe(100);

    const pipe = project.hydraulicModel.assets.get(4) as Pipe;
    expect(pipe.type).toBe("pipe");
    expect(pipe.diameter).toBe(150);
    expect(pipe.length).toBe(200);
    expect(pipe.connections).toEqual([1, 2]);

    expect(project.hydraulicModel.patterns.size).toBe(1);
    const pattern = project.hydraulicModel.patterns.get(6);
    expect(pattern?.label).toBe("daily");
    expect(pattern?.multipliers).toEqual([1, 0.8, 1.2, 0.9]);

    expect(project.hydraulicModel.curves.size).toBe(1);
    const curve = project.hydraulicModel.curves.get(7);
    expect(curve?.type).toBe("pump");
    expect(curve?.points).toEqual([
      { x: 0, y: 50 },
      { x: 10, y: 30 },
    ]);

    expect(project.hydraulicModel.customerPoints.size).toBe(1);
    const cp = project.hydraulicModel.customerPoints.get(8);
    expect(cp?.label).toBe("CP1");
    expect(cp?.coordinates).toEqual([0.5, 0.5]);
    expect(cp?.connection?.pipeId).toBe(4);
    expect(cp?.connection?.junctionId).toBe(2);

    expect(project.hydraulicModel.demands.customerPoints.get(8)).toEqual([
      { baseDemand: 5, patternId: 6 },
    ]);
    expect(project.hydraulicModel.demands.junctions.get(1)).toEqual([
      { baseDemand: 2.5, patternId: 6 },
    ]);
  });

  it("isolates state between tests (no leftover data from previous test)", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.assets.size).toBe(1);
  });

  it("round-trips pipe library data", async () => {
    const pipeLibrary = [
      {
        label: "Cast Iron",
        entries: [
          { age: 0, roughness: 130 },
          { age: 10, roughness: 100 },
        ],
      },
    ];

    const builder = HydraulicModelBuilder.with().aJunction(1);
    pipeLibrary.forEach((material) => builder.aPipeMaterial(material));

    await importProject({
      newDb: true,
      hydraulicModel: builder.build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.pipeMaterials).toEqual(pipeLibrary);
  });

  it("returns empty array when no pipe library was saved", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.pipeMaterials).toEqual([]);
  });

  it("round-trips the custom attributes definition", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const definition = setAttributes(
      emptyCustomAttributesDefinition(),
      "pipe",
      [{ id: "custom-1", label: "Material", type: "text" }],
    );
    await saveCustomAttributes(definition);

    const project = await fetchProject();
    expect(getAttributes(project.customAttributes, "pipe")).toEqual([
      { id: "custom-1", label: "Material", type: "text" },
    ]);
  });

  it("returns an empty definition when none was saved (migrated default)", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const project = await fetchProject();
    expect(project.customAttributes.size).toBe(0);
  });

  describe("when the roughness column is null", () => {
    const importPipeWithNullRoughness = () =>
      importProject({
        newDb: true,
        hydraulicModel: HydraulicModelBuilder.with()
          .aJunction(1)
          .aJunction(2)
          .aPipe(3, { startNodeId: 1, endNodeId: 2, roughness: null })
          .build(),
        projectSettings: defaultProjectSettings,
        simulationSettings: defaultSimulationSettings,
      });

    it("keeps it empty with fetchProject", async () => {
      await importPipeWithNullRoughness();

      const project = await fetchProject();

      expect(
        (project.hydraulicModel.assets.get(3) as Pipe).roughness,
      ).toBeNull();
    });
  });
});

describe("fetch-project id pools", () => {
  useInProcessDb();

  const IDS = {
    J1: 1,
    J2: 2,
    VALVE1: 20,
    PAT1: 40,
    PAT2: 41,
    CUR1: 60,
    CUR2: 61,
    ZONE1: 80,
    ZONE2: 81,
    CP1: 90,
    CP2: 91,
  } as const;

  const aSquare = (x: number): MultiPolygon => ({
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [x, 0],
          [x + 1, 0],
          [x + 1, 1],
          [x, 1],
          [x, 0],
        ],
      ],
    ],
  });

  const seed = () =>
    importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aDemandPattern(IDS.PAT1, "PAT1", [1])
        .aDemandPattern(IDS.PAT2, "PAT2", [1])
        .build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

  it("continues the pattern pool from the patterns table, not the asset maximum", async () => {
    await seed();

    const { factories } = await fetchProject({ idPools: true });

    expect(factories.idPools.newId("pattern")).toBe(IDS.PAT2 + 1);
    expect(factories.idPools.newId("asset")).toBe(IDS.J1 + 1);
  });

  it("draws patterns from the asset pool when the flag is off", async () => {
    await seed();

    const { factories } = await fetchProject();

    expect(factories.idPools.newId("pattern")).toBe(IDS.J1 + 1);
    expect(factories.idPools.forPool("pattern")).toBe(factories.idGenerator);
  });

  it("continues the curve pool from the curves table, not the asset maximum", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aCurve({
          id: IDS.CUR1,
          label: "CUR1",
          points: [{ x: 0, y: 1 }],
          type: "volume",
        })
        .aCurve({
          id: IDS.CUR2,
          label: "CUR2",
          points: [{ x: 0, y: 1 }],
          type: "volume",
        })
        .build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const { factories } = await fetchProject({ idPools: true });

    expect(factories.idPools.newId("curve")).toBe(IDS.CUR2 + 1);
    expect(factories.idPools.newId("asset")).toBe(IDS.J1 + 1);
  });

  it("continues the customer point pool from its own table, not the asset maximum", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aCustomerPoint(IDS.CP1)
        .aCustomerPoint(IDS.CP2)
        .build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const { factories } = await fetchProject({ idPools: true });

    expect(factories.idPools.newId("customerPoint")).toBe(IDS.CP2 + 1);
  });

  const aJunctionWithACustomerPointAbove = () =>
    importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aCustomerPoint(IDS.CP2)
        .build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

  it("continues the asset pool from the asset tables, not customer point ids", async () => {
    await aJunctionWithACustomerPointAbove();

    const { factories } = await fetchProject({ idPools: true });

    expect(factories.idPools.newId("asset")).toBe(IDS.J1 + 1);
  });

  it("continues the asset pool from the highest asset of any kind", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aJunction(IDS.J2)
        .aValve(IDS.VALVE1, { startNodeId: IDS.J1, endNodeId: IDS.J2 })
        .build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const { factories } = await fetchProject({ idPools: true });

    expect(factories.idPools.newId("asset")).toBe(IDS.VALVE1 + 1);
  });

  it("seeds the shared sequence above customer point ids when the flag is off", async () => {
    await aJunctionWithACustomerPointAbove();

    const { factories } = await fetchProject();

    expect(factories.idPools.newId("asset")).toBe(IDS.CP2 + 1);
  });

  it("continues the zone pool from the zones table, not the asset maximum", async () => {
    await importProject({
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
      zones: new Map([
        [
          IDS.ZONE1,
          {
            id: IDS.ZONE1,
            label: "ZA",
            geometry: aSquare(0),
            bbox: [0, 0, 1, 1] as BBox,
          },
        ],
        [
          IDS.ZONE2,
          {
            id: IDS.ZONE2,
            label: "ZB",
            geometry: aSquare(2),
            bbox: [2, 0, 3, 1] as BBox,
          },
        ],
      ]),
    });

    const { factories } = await fetchProject({ idPools: true });

    expect(factories.idPools.newId("zone")).toBe(IDS.ZONE2 + 1);
    expect(factories.idPools.newId("asset")).toBe(IDS.J1 + 1);
  });
});
