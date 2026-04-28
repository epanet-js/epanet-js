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
import { buildAssetsData } from "./mappers/assets/builders";
import { buildCustomerPointsData } from "./mappers/customer-points/builders";
import { buildPatternsData } from "./mappers/patterns/builders";
import { buildCurvesData } from "./mappers/curves/builders";
import { buildControlsData } from "./mappers/controls/builders";
import { buildSimulationSettingsData } from "./mappers/simulation-settings/builders";
import { buildProjectSettingsData } from "./mappers/project-settings/builders";
import { buildJunctionDemandsData } from "./mappers/junction-demands/builders";
import { findMaxId } from "./ids";
import type {
  JunctionRow,
  ReservoirRow,
  TankRow,
  PipeRow,
  PumpRow,
  ValveRow,
} from "./mappers/assets/schema";
import type {
  CustomerPointRow,
  CustomerPointDemandRow,
  CustomerPointsData,
} from "./mappers/customer-points/schema";
import type { PatternRow } from "./mappers/patterns/schema";
import type { JunctionDemandRow } from "./mappers/junction-demands/schema";
import type { CurveRow } from "./mappers/curves/schema";

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
        const projectSettings = buildProjectSettingsData(settingsJson);
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
