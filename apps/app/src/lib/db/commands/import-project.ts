import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import type { Zones } from "src/lib/zones";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { getWorker, timed } from "@epanet-js/ejsdb";
import {
  assetsToRows,
  customerPointsToRows,
  patternsToRows,
  curvesToRows,
  serializeRawControls,
  serializeControls,
  serializePipeLibrary,
  junctionDemandsToRows,
} from "@epanet-js/ejsdb-mappers";
import { serializeProjectSettings } from "../mappers/project-settings/to-rows";
import { serializeZones } from "../mappers/zones/to-rows";
import { serializeSimulationSettings } from "../mappers/simulation-settings/to-rows";

export type ImportProjectInput = {
  newDb?: boolean;
  projectSettings?: ProjectSettings;
  pipeLibrary?: PipeMaterial[];
  zones?: Zones;
  hydraulicModel: HydraulicModel;
  simulationSettings: SimulationSettings;
};

export const importProject = async (
  input: ImportProjectInput,
): Promise<void> => {
  await timed("importProject", async () => {
    const projectSettings = input.projectSettings
      ? serializeProjectSettings(input.projectSettings)
      : null;
    const pipeLibrary =
      input.pipeLibrary && input.pipeLibrary.length > 0
        ? serializePipeLibrary(input.pipeLibrary)
        : null;
    const zones = input.zones ? serializeZones(input.zones) : null;
    const assets = assetsToRows(input.hydraulicModel.assets.values());

    await getWorker().importProject({
      newDb: input.newDb ?? false,
      projectSettings,
      pipeLibrary,
      zones,
      assets,
      customerPoints: customerPointsToRows(
        input.hydraulicModel.customerPoints,
        input.hydraulicModel.demands.customerPoints,
      ),
      patterns: patternsToRows(input.hydraulicModel.patterns),
      curves: curvesToRows(input.hydraulicModel.curves),
      rawControls: serializeRawControls(input.hydraulicModel.rawControls),
      controls: serializeControls(input.hydraulicModel.controls),
      simulationSettings: serializeSimulationSettings(input.simulationSettings),
      junctionDemands: junctionDemandsToRows(
        input.hydraulicModel.demands.junctions,
      ),
    });
  });
};
