import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "src/lib/project-settings";
import {
  defaultSimulationSettings,
  type SimulationSettings,
} from "src/simulation/simulation-settings";
import type { ProjectSettings } from "src/lib/project-settings";
import type { Junction } from "src/hydraulic-model/asset-types/junction";
import type { Reservoir } from "src/hydraulic-model/asset-types/reservoir";
import type { Pipe } from "src/hydraulic-model/asset-types/pipe";
import { exportDb } from "./export-db";
import { fetchProject } from "./fetch-project";
import { importProject } from "./import-project";
import { openProject } from "./open-project";
import { useInProcessDb } from "../__test-helpers__/in-process-db";

describe("open integration", () => {
  useInProcessDb();

  it("round-trips a project through importProject -> exportDb -> openProject -> fetchProject", async () => {
    const projectSettings: ProjectSettings = {
      ...defaultProjectSettings,
      name: "open round-trip",
    };
    const simulationSettings: SimulationSettings = {
      ...defaultSimulationSettings,
      globalDemandMultiplier: 1.5,
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

    const blob = await exportDb();
    const file = new File([blob], "round-trip.epnt", {
      type: "application/octet-stream",
    });

    const openResult = await openProject(file);
    expect(openResult.status).toBe("ok");

    const project = await fetchProject();

    expect(project.projectSettings.name).toBe("open round-trip");
    expect(project.simulationSettings.globalDemandMultiplier).toBe(1.5);

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
});
