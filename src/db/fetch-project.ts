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
import {
  findMaxAssetId,
  type JunctionRow,
  type ReservoirRow,
  type TankRow,
  type PipeRow,
  type PumpRow,
  type ValveRow,
} from "./rows";

export type Project = {
  projectSettings: ProjectSettings;
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
};

export const fetchProject = async (): Promise<Project> => {
  const worker = getDbWorker();
  const [settingsJson, junctions, reservoirs, tanks, pipes, pumps, valves] =
    await Promise.all([
      worker.getProjectSettings(),
      worker.getJunctions() as Promise<JunctionRow[]>,
      worker.getReservoirs() as Promise<ReservoirRow[]>,
      worker.getTanks() as Promise<TankRow[]>,
      worker.getPipes() as Promise<PipeRow[]>,
      worker.getPumps() as Promise<PumpRow[]>,
      worker.getValves() as Promise<ValveRow[]>,
    ]);
  if (!settingsJson) {
    throw new Error("Project settings missing");
  }
  const projectSettings = projectSettingsSchema.parse(JSON.parse(settingsJson));
  const rows = { junctions, reservoirs, tanks, pipes, pumps, valves };

  const maxId = findMaxAssetId(rows);
  const idGenerator = new ConsecutiveIdsGenerator(maxId);
  const factories = initializeModelFactories({
    idGenerator,
    labelManager: new LabelManager(),
    defaults: projectSettings.defaults,
  });

  const { assets, assetIndex, topology } = buildAssetsData(rows, factories);
  const hydraulicModel = initializeHydraulicModel({
    idGenerator,
    assets,
    assetIndex,
    topology,
  });

  return { projectSettings, hydraulicModel, factories };
};
