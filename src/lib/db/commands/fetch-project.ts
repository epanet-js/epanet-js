import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { getDbWorker } from "../get-db-worker";
import { timed } from "../perf-log";
import { buildAssetsData } from "../mappers/assets/builders";
import { buildCustomerPointsData } from "../mappers/customer-points/builders";
import { buildPatternsData } from "../mappers/patterns/builders";
import { buildCurvesData } from "../mappers/curves/builders";
import { buildControlsData } from "../mappers/controls/builders";
import { buildSimulationSettingsData } from "../mappers/simulation-settings/builders";
import { buildProjectSettingsData } from "../mappers/project-settings/builders";
import { buildJunctionDemandsData } from "../mappers/junction-demands/builders";

export type Project = {
  projectSettings: ProjectSettings;
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  simulationSettings: SimulationSettings;
};

export type FetchProjectPhase =
  | "reading-assets"
  | "reading-customer-points"
  | "reading-settings"
  | "building";

export type FetchProjectOptions = {
  onProgress?: (phase: FetchProjectPhase) => void;
};

export const fetchProject = async (
  options: FetchProjectOptions = {},
): Promise<Project> => {
  const { onProgress } = options;
  return timed("fetchProject", async () => {
    const worker = getDbWorker();

    onProgress?.("reading-assets");
    const [
      junctionsRaw,
      reservoirsRaw,
      tanksRaw,
      pipesRaw,
      pumpsRaw,
      valvesRaw,
    ] = await timed("fetchProject.readAssets", () =>
      Promise.all([
        worker.getJunctions(),
        worker.getReservoirs(),
        worker.getTanks(),
        worker.getPipes(),
        worker.getPumps(),
        worker.getValves(),
      ]),
    );

    onProgress?.("reading-customer-points");
    const [customerPointsRaw, customerPointDemandsRaw] = await timed(
      "fetchProject.readCustomerPoints",
      () =>
        Promise.all([
          worker.getCustomerPoints(),
          worker.getCustomerPointDemands(),
        ]),
    );

    onProgress?.("reading-settings");
    const [
      settingsJson,
      patternsRaw,
      junctionDemandsRaw,
      curvesRaw,
      controlsData,
      simulationSettingsData,
      maxId,
    ] = await timed("fetchProject.readSettings", () =>
      Promise.all([
        worker.getProjectSettings(),
        worker.getPatterns(),
        worker.getJunctionDemands(),
        worker.getCurves(),
        worker.getControls(),
        worker.getSimulationSettings(),
        worker.getMaxId(),
      ]),
    );
    if (!settingsJson) {
      throw new Error("Project settings missing");
    }
    onProgress?.("building");
    await new Promise((resolve) => setTimeout(resolve, 0));
    return timed(
      "fetchProject.build",
      () => {
        const projectSettings = buildProjectSettingsData(settingsJson);

        const idGenerator = new ConsecutiveIdsGenerator(maxId);
        const factories = initializeModelFactories({
          idGenerator,
          labelManager: new LabelManager(),
          defaults: projectSettings.defaults,
        });

        const { assets, assetIndex, topology } = buildAssetsData(
          {
            junctions: junctionsRaw,
            reservoirs: reservoirsRaw,
            tanks: tanksRaw,
            pipes: pipesRaw,
            pumps: pumpsRaw,
            valves: valvesRaw,
          },
          factories,
        );
        const { customerPoints, customerPointsLookup, customerDemands } =
          buildCustomerPointsData(
            {
              customerPoints: customerPointsRaw,
              demands: customerPointDemandsRaw,
            },
            factories,
          );
        const patterns = buildPatternsData(patternsRaw);
        const curves = buildCurvesData(curvesRaw);
        const controls = buildControlsData(controlsData);
        const simulationSettings = buildSimulationSettingsData(
          simulationSettingsData,
        );
        const junctionDemands = buildJunctionDemandsData(junctionDemandsRaw);

        const hydraulicModel = initializeHydraulicModel({
          idGenerator,
          assets,
          assetIndex,
          topology,
          customerPoints,
          customerPointsLookup,
          patterns,
          curves,
          controls,
          demands: {
            junctions: junctionDemands,
            customerPoints: customerDemands,
          },
        });

        return {
          projectSettings,
          hydraulicModel,
          factories,
          simulationSettings,
        };
      },
      {
        j: junctionsRaw.length,
        r: reservoirsRaw.length,
        t: tanksRaw.length,
        p: pipesRaw.length,
        pu: pumpsRaw.length,
        v: valvesRaw.length,
        cp: customerPointsRaw.length,
      },
    );
  });
};
