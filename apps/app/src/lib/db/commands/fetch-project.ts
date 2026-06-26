import type { ProjectSettings } from "src/lib/project-settings";
import type { PipeMaterial } from "src/lib/pipe-library";
import type { CustomAttributesDefinition } from "src/lib/custom-attributes";
import type { Zones } from "src/lib/zones";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { HydraulicModel, initializeHydraulicModel } from "src/hydraulic-model";
import {
  ModelFactories,
  initializeModelFactories,
  initializeModelFactoriesWithNullValues,
  LabelManager,
} from "@epanet-js/hydraulic-model";
import { ConsecutiveIdsGenerator } from "@epanet-js/id-generator";
import { getWorker, timed } from "@epanet-js/ejsdb";
import {
  buildAssetsData,
  buildCustomerPointsData,
  buildPatternsData,
  buildCurvesData,
  buildRawControlsData,
  buildControlsData,
  buildJunctionDemandsData,
  buildCustomAttributesDefinition,
} from "@epanet-js/ejsdb-mappers";
import { buildSimulationSettingsData } from "../mappers/simulation-settings/builders";
import { buildProjectSettingsData } from "../mappers/project-settings/builders";
import { buildPipeLibraryData } from "../mappers/pipe-library/builders";
import { buildZonesData } from "../mappers/zones/builders";

export type Project = {
  projectSettings: ProjectSettings;
  pipeLibrary: PipeMaterial[];
  customAttributes: CustomAttributesDefinition;
  zones: Zones;
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

type InitializeModelFactories = typeof initializeModelFactories;

const fetchProjectWith = async (
  initializeFactories: InitializeModelFactories,
  options: FetchProjectOptions = {},
): Promise<Project> => {
  const { onProgress } = options;
  return timed("fetchProject", async () => {
    const worker = getWorker();

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
      pipeLibraryJson,
      customAttributesJson,
      zonesRaw,
      patternsRaw,
      junctionDemandsRaw,
      curvesRaw,
      rawControlsData,
      controlsData,
      simulationSettingsData,
      maxId,
    ] = await timed("fetchProject.readSettings", () =>
      Promise.all([
        worker.getProjectSettings(),
        worker.getPipeLibrary(),
        worker.getCustomAttributesDefinition(),
        worker.getZones(),
        worker.getPatterns(),
        worker.getJunctionDemands(),
        worker.getCurves(),
        worker.getRawControls(),
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
        const pipeLibrary = buildPipeLibraryData(pipeLibraryJson);
        const customAttributes =
          buildCustomAttributesDefinition(customAttributesJson);
        const zones = buildZonesData(zonesRaw);

        const idGenerator = new ConsecutiveIdsGenerator(maxId);
        const factories = initializeFactories({
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
        const rawControls = buildRawControlsData(rawControlsData);
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
          rawControls,
          controls,
          demands: {
            junctions: junctionDemands,
            customerPoints: customerDemands,
          },
        });

        return {
          projectSettings,
          pipeLibrary,
          customAttributes,
          zones,
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

export const fetchProject = (
  options: FetchProjectOptions = {},
): Promise<Project> => fetchProjectWith(initializeModelFactories, options);

export const fetchProjectWithNullValues = (
  options: FetchProjectOptions = {},
): Promise<Project> =>
  fetchProjectWith(initializeModelFactoriesWithNullValues, options);
