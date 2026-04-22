import { projectSettingsSchema } from "src/lib/project-settings/project-settings-schema";
import type { ProjectSettings } from "src/lib/project-settings";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import {
  ModelFactories,
  initializeModelFactories,
} from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { ConsecutiveIdsGenerator } from "src/lib/id-generator";
import { getDbWorker } from "./get-db-worker";
import { buildAssetsData } from "./build-assets-data";
import { buildCustomerPointsData } from "./build-customer-points-data";
import { buildPatternsData } from "./build-patterns-data";
import { buildCurvesData } from "./build-curves-data";
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
};

export const fetchProject = async (): Promise<Project> => {
  const worker = getDbWorker();
  const [
    settingsJson,
    junctions,
    reservoirs,
    tanks,
    pipes,
    pumps,
    valves,
    customerPointRows,
    customerPointDemandRows,
    patternRows,
    junctionDemandRows,
    curveRows,
  ] = await Promise.all([
    worker.getProjectSettings(),
    worker.getJunctions() as Promise<JunctionRow[]>,
    worker.getReservoirs() as Promise<ReservoirRow[]>,
    worker.getTanks() as Promise<TankRow[]>,
    worker.getPipes() as Promise<PipeRow[]>,
    worker.getPumps() as Promise<PumpRow[]>,
    worker.getValves() as Promise<ValveRow[]>,
    worker.getCustomerPoints() as Promise<CustomerPointRow[]>,
    worker.getCustomerPointDemands() as Promise<CustomerPointDemandRow[]>,
    worker.getPatterns() as Promise<PatternRow[]>,
    worker.getJunctionDemands() as Promise<JunctionDemandRow[]>,
    worker.getCurves() as Promise<CurveRow[]>,
  ]);
  if (!settingsJson) {
    throw new Error("Project settings missing");
  }
  const projectSettings = projectSettingsSchema.parse(JSON.parse(settingsJson));
  const assetRows = { junctions, reservoirs, tanks, pipes, pumps, valves };
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
    demands: { junctions: junctionDemands, customerPoints: customerDemands },
  });

  return { projectSettings, hydraulicModel, factories };
};
