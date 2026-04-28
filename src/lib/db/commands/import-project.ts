import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { AssetsMap } from "src/hydraulic-model/assets-map";
import type { CustomerPoints } from "src/hydraulic-model/customer-points";
import type {
  CustomerAssignedDemands,
  JunctionAssignedDemands,
} from "src/hydraulic-model/demands";
import type { Patterns } from "src/hydraulic-model/patterns";
import type { Curves } from "src/hydraulic-model/curves";
import type { Controls } from "src/hydraulic-model/controls";
import { getDbWorker } from "../get-db-worker";
import { timed } from "../perf-log";
import { assetsToRows } from "../mappers/assets/to-rows";
import { customerPointsToRows } from "../mappers/customer-points/to-rows";
import { patternsToRows } from "../mappers/patterns/to-rows";
import { curvesToRows } from "../mappers/curves/to-rows";
import { serializeControls } from "../mappers/controls/to-rows";
import { junctionDemandsToRows } from "../mappers/junction-demands/to-rows";
import { newProject } from "./new-project";
import { saveProjectSettings } from "./save-project-settings";
import { setAllSimulationSettings } from "./set-all-simulation-settings";

export type ImportProjectInput = {
  newDb?: boolean;
  projectSettings?: ProjectSettings;
  hydraulicModel: HydraulicModel;
  simulationSettings: SimulationSettings;
};

export const importProject = async (
  input: ImportProjectInput,
): Promise<void> => {
  await timed("importProject", async () => {
    if (input.newDb) {
      await newProject();
    }
    if (input.projectSettings) {
      await saveProjectSettings(input.projectSettings);
    }
    await writeAllAssets(input.hydraulicModel.assets);
    await writeAllCustomerPoints(
      input.hydraulicModel.customerPoints,
      input.hydraulicModel.demands.customerPoints,
    );
    await writeAllPatterns(input.hydraulicModel.patterns);
    await writeAllCurves(input.hydraulicModel.curves);
    await writeAllControls(input.hydraulicModel.controls);
    await setAllSimulationSettings(input.simulationSettings);
    await writeAllJunctionDemands(input.hydraulicModel.demands.junctions);
  });
};

const writeAllAssets = (assets: AssetsMap) =>
  timed("setAllAssets", async () => {
    await getDbWorker().setAllAssets(assetsToRows(assets.values()));
  });

const writeAllCustomerPoints = (
  customerPoints: CustomerPoints,
  customerDemands: CustomerAssignedDemands,
) =>
  timed("setAllCustomerPoints", async () => {
    await getDbWorker().setAllCustomerPoints(
      customerPointsToRows(customerPoints, customerDemands),
    );
  });

const writeAllPatterns = (patterns: Patterns) =>
  timed("setAllPatterns", async () => {
    await getDbWorker().setAllPatterns(patternsToRows(patterns));
  });

const writeAllCurves = (curves: Curves) =>
  timed("setAllCurves", async () => {
    await getDbWorker().setAllCurves(curvesToRows(curves));
  });

const writeAllControls = (controls: Controls) =>
  timed("setAllControls", async () => {
    await getDbWorker().setAllControls(serializeControls(controls));
  });

const writeAllJunctionDemands = (junctions: JunctionAssignedDemands) =>
  timed("setAllJunctionDemands", async () => {
    await getDbWorker().setAllJunctionDemands(junctionDemandsToRows(junctions));
  });
