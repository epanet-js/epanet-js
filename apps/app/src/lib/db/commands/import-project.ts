import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import type { Zones } from "src/lib/zones";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import type { AssetsMap } from "@epanet-js/hydraulic-model";
import {
  type CustomerPoints,
  type Patterns,
  type Curves,
} from "@epanet-js/hydraulic-model";
import type {
  CustomerAssignedDemands,
  JunctionAssignedDemands,
} from "@epanet-js/hydraulic-model";
import type { Controls } from "@epanet-js/hydraulic-model";
import { getWorker, timed } from "@epanet-js/ejsdb";
import {
  assetsToRows,
  customerPointsToRows,
  patternsToRows,
  curvesToRows,
  serializeControls,
  junctionDemandsToRows,
} from "@epanet-js/ejsdb-mappers";
import { newProject } from "./new-project";
import { saveProjectSettings } from "./save-project-settings";
import { saveZones } from "./save-zones";
import { setAllSimulationSettings } from "./set-all-simulation-settings";

export type ImportProjectInput = {
  newDb?: boolean;
  projectSettings?: ProjectSettings;
  zones?: Zones;
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
    if (input.zones) {
      await saveZones(input.zones);
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
    await getWorker().setAllAssets(assetsToRows(assets.values()));
  });

const writeAllCustomerPoints = (
  customerPoints: CustomerPoints,
  customerDemands: CustomerAssignedDemands,
) =>
  timed("setAllCustomerPoints", async () => {
    await getWorker().setAllCustomerPoints(
      customerPointsToRows(customerPoints, customerDemands),
    );
  });

const writeAllPatterns = (patterns: Patterns) =>
  timed("setAllPatterns", async () => {
    await getWorker().setAllPatterns(patternsToRows(patterns));
  });

const writeAllCurves = (curves: Curves) =>
  timed("setAllCurves", async () => {
    await getWorker().setAllCurves(curvesToRows(curves));
  });

const writeAllControls = (controls: Controls) =>
  timed("setAllControls", async () => {
    await getWorker().setAllControls(serializeControls(controls));
  });

const writeAllJunctionDemands = (junctions: JunctionAssignedDemands) =>
  timed("setAllJunctionDemands", async () => {
    await getWorker().setAllJunctionDemands(junctionDemandsToRows(junctions));
  });
