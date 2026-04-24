import { projectSettingsSchema } from "src/lib/project-settings/project-settings-schema";
import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { getDbWorker } from "./get-db-worker";
import { timed } from "./perf-log";
import { buildAssetsData } from "./build-assets-data";
import { buildCustomerPointsData } from "./build-customer-points-data";
import { buildPatternsData } from "./build-patterns-data";
import { buildCurvesData } from "./build-curves-data";
import { buildControlsData } from "./build-controls-data";
import { buildSimulationSettingsData } from "./build-simulation-settings-data";
import { buildJunctionDemandsData } from "./build-junction-demands-data";
import {
  findMaxId,
  type JunctionRow,
  type ReservoirRow,
  type TankRow,
  type PipeRow,
  type PumpRow,
  type ValveRow,
  type CustomerPointRow,
  type CustomerPointDemandRow,
  type CustomerPointsData,
  type PatternRow,
  type JunctionDemandRow,
  type CurveRow,
} from "./rows";

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
    const [junctions, reservoirs, tanks, pipes, pumps, valves] = await timed(
      "fetchProject.readAssets",
      () =>
        Promise.all([
          worker.getJunctions() as Promise<JunctionRow[]>,
          worker.getReservoirs() as Promise<ReservoirRow[]>,
          worker.getTanks() as Promise<TankRow[]>,
          worker.getPipes() as Promise<PipeRow[]>,
          worker.getPumps() as Promise<PumpRow[]>,
          worker.getValves() as Promise<ValveRow[]>,
        ]),
    );

    onProgress?.("reading-customer-points");
    const [customerPointRows, customerPointDemandRows] = await timed(
      "fetchProject.readCustomerPoints",
      () =>
        Promise.all([
          worker.getCustomerPoints() as Promise<CustomerPointRow[]>,
          worker.getCustomerPointDemands() as Promise<CustomerPointDemandRow[]>,
        ]),
    );

    onProgress?.("reading-settings");
    const [
      settingsJson,
      patternRows,
      junctionDemandRows,
      curveRows,
      controlsData,
      simulationSettingsData,
    ] = await timed("fetchProject.readSettings", () =>
      Promise.all([
        worker.getProjectSettings(),
        worker.getPatterns() as Promise<PatternRow[]>,
        worker.getJunctionDemands() as Promise<JunctionDemandRow[]>,
        worker.getCurves() as Promise<CurveRow[]>,
        worker.getControls(),
        worker.getSimulationSettings(),
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
        const projectSettings = projectSettingsSchema.parse(
          JSON.parse(settingsJson),
        );
        const assetRows = {
          junctions,
          reservoirs,
          tanks,
          pipes,
          pumps,
          valves,
        };
        const cpData: CustomerPointsData = {
          customerPoints: customerPointRows,
          demands: customerPointDemandRows,
        };

        const maxId = findMaxId(assetRows, cpData, patternRows, curveRows);
        const idGenerator = new ConsecutiveIdsGenerator(maxId);
        const factories = initializeModelFactories({
          idGenerator,
          labelManager: new LabelManager(),
          defaults: projectSettings.defaults,
        });

        const { assets, assetIndex, topology } = buildAssetsData(
          assetRows,
          factories,
        );
        const { customerPoints, customerPointsLookup, customerDemands } =
          buildCustomerPointsData(cpData, factories);
        const patterns = buildPatternsData(patternRows);
        const curves = buildCurvesData(curveRows);
        const controls = buildControlsData(controlsData);
        const simulationSettings = buildSimulationSettingsData(
          simulationSettingsData,
        );
        const junctionDemands = buildJunctionDemandsData(junctionDemandRows);

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
        j: junctions.length,
        r: reservoirs.length,
        t: tanks.length,
        p: pipes.length,
        pu: pumps.length,
        v: valves.length,
        cp: customerPointRows.length,
      },
    );
  });
};
