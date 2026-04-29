import { z } from "zod";
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
import {
  junctionRowSchema,
  reservoirRowSchema,
  tankRowSchema,
  pipeRowSchema,
  pumpRowSchema,
  valveRowSchema,
} from "../mappers/assets/schema";
import {
  customerPointRowSchema,
  customerPointDemandRowSchema,
  type CustomerPointsData,
} from "../mappers/customer-points/schema";
import { patternRowSchema } from "../mappers/patterns/schema";
import { junctionDemandRowSchema } from "../mappers/junction-demands/schema";
import { curveRowSchema } from "../mappers/curves/schema";

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

const parseRows = <S extends z.ZodTypeAny>(
  schema: S,
  rows: unknown[],
  kind: string,
): z.infer<S>[] => {
  const arraySchema = z.array(schema);
  const result = arraySchema.safeParse(rows);
  if (!result.success) {
    throw new Error(
      `${kind}: row data does not match schema — ${result.error.message}`,
    );
  }
  return result.data;
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
        const assetRows = {
          junctions: parseRows(junctionRowSchema, junctionsRaw, "Junctions"),
          reservoirs: parseRows(
            reservoirRowSchema,
            reservoirsRaw,
            "Reservoirs",
          ),
          tanks: parseRows(tankRowSchema, tanksRaw, "Tanks"),
          pipes: parseRows(pipeRowSchema, pipesRaw, "Pipes"),
          pumps: parseRows(pumpRowSchema, pumpsRaw, "Pumps"),
          valves: parseRows(valveRowSchema, valvesRaw, "Valves"),
        };
        const cpData: CustomerPointsData = {
          customerPoints: parseRows(
            customerPointRowSchema,
            customerPointsRaw,
            "CustomerPoints",
          ),
          demands: parseRows(
            customerPointDemandRowSchema,
            customerPointDemandsRaw,
            "CustomerPointDemands",
          ),
        };
        const patternRows = parseRows(
          patternRowSchema,
          patternsRaw,
          "Patterns",
        );
        const junctionDemandRows = parseRows(
          junctionDemandRowSchema,
          junctionDemandsRaw,
          "JunctionDemands",
        );
        const curveRows = parseRows(curveRowSchema, curvesRaw, "Curves");

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
