import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { newProject } from "./new-project";
import { saveProjectSettings } from "./save-project-settings";
import { setAllAssets } from "./set-all-assets";
import { setAllCustomerPoints } from "./set-all-customer-points";
import { setAllPatterns } from "./set-all-patterns";
import { setAllCurves } from "./set-all-curves";
import { setAllControls } from "./set-all-controls";
import { setAllSimulationSettings } from "./set-all-simulation-settings";
import { setAllJunctionDemands } from "./set-all-junction-demands";
import { timed } from "./perf-log";

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
    await setAllAssets(input.hydraulicModel.assets);
    await setAllCustomerPoints(
      input.hydraulicModel.customerPoints,
      input.hydraulicModel.demands.customerPoints,
    );
    await setAllPatterns(input.hydraulicModel.patterns);
    await setAllCurves(input.hydraulicModel.curves);
    await setAllControls(input.hydraulicModel.controls);
    await setAllSimulationSettings(input.simulationSettings);
    await setAllJunctionDemands(input.hydraulicModel.demands.junctions);
  });
};
