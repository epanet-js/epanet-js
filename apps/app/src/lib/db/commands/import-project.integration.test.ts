import { describe, expect, it } from "vitest";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { defaultProjectSettings } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import type { HydraulicModel } from "src/hydraulic-model";
import { api } from "@epanet-js/ejsdb/worker-api";
import type { ImportProjectPayload } from "@epanet-js/ejsdb";
import {
  assetsToRows,
  customerPointsToRows,
  patternsToRows,
  curvesToRows,
  serializeRawControls,
  serializeControls,
  junctionDemandsToRows,
} from "@epanet-js/ejsdb-mappers";
import { serializeSimulationSettings } from "../mappers/simulation-settings/to-rows";
import { fetchProject } from "./fetch-project";
import { importProject } from "./import-project";
import { useInProcessDb } from "../__test-helpers__/in-process-db";
import { getWorker } from "@epanet-js/ejsdb";
import { buildIdPoolsData } from "@epanet-js/ejsdb-mappers";

describe("import-project integration", () => {
  useInProcessDb();

  it("replaces network data in the open db when newDb is false", async () => {
    const IDS = { J1: 1, J2: 2 } as const;
    await importProject({
      idPools: null,
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      projectSettings: { ...defaultProjectSettings, name: "original" },
      simulationSettings: defaultSimulationSettings,
    });

    await importProject({
      idPools: null,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J2).build(),
      simulationSettings: defaultSimulationSettings,
    });

    const project = await fetchProject();
    expect(project.hydraulicModel.assets.size).toBe(1);
    expect(project.hydraulicModel.assets.get(IDS.J2)).toBeDefined();
    expect(project.projectSettings.name).toBe("original");
  });

  it("stores the id pools with the project", async () => {
    const idPools = {
      asset: 1,
      customerPoint: 2,
      pattern: 3,
      curve: 4,
      zone: 5,
    };

    await importProject({
      idPools,
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    expect(buildIdPoolsData(await getWorker().getIdPools())).toEqual(idPools);
  });

  it("stores no id pools without a snapshot", async () => {
    await importProject({
      idPools: null,
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    expect(await getWorker().getIdPools()).toBeNull();
  });

  it("rolls back every write when one write fails", async () => {
    const IDS = { J1: 1, J2: 2, J3: 3 } as const;
    await importProject({
      idPools: null,
      newDb: true,
      hydraulicModel: HydraulicModelBuilder.with()
        .aJunction(IDS.J1)
        .aDemandPattern(4, "daily", [1, 0.8])
        .build(),
      projectSettings: defaultProjectSettings,
      simulationSettings: defaultSimulationSettings,
    });

    const payload = payloadFor(
      HydraulicModelBuilder.with().aJunction(IDS.J2).aJunction(IDS.J3).build(),
    );
    payload.assets.junctions[1].id = payload.assets.junctions[0].id;

    await expect(api.importProject(payload)).rejects.toThrow();

    const project = await fetchProject();
    expect(project.hydraulicModel.assets.size).toBe(1);
    expect(project.hydraulicModel.assets.get(IDS.J1)).toBeDefined();
    expect(project.hydraulicModel.patterns.size).toBe(1);
  });
});

const payloadFor = (hydraulicModel: HydraulicModel): ImportProjectPayload => ({
  newDb: false,
  projectSettings: null,
  pipeLibrary: null,
  idPools: null,
  zones: null,
  assets: assetsToRows(hydraulicModel.assets.values()),
  customerPoints: customerPointsToRows(
    hydraulicModel.customerPoints,
    hydraulicModel.demands.customerPoints,
  ),
  patterns: patternsToRows(hydraulicModel.patterns),
  curves: curvesToRows(hydraulicModel.curves),
  rawControls: serializeRawControls(hydraulicModel.rawControls),
  controls: serializeControls(hydraulicModel.controls),
  simulationSettings: serializeSimulationSettings(defaultSimulationSettings),
  junctionDemands: junctionDemandsToRows(hydraulicModel.demands.junctions),
});
