import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { captureWarning } from "src/infra/error-tracking";
import type { HydraulicModel } from "src/hydraulic-model";
import { type ModelFactories } from "@epanet-js/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import type { PipeMaterial } from "@epanet-js/pipe-library";
import type { Zones } from "src/lib/zones";
import { initializeZones } from "src/lib/zones";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initializeWorktree } from "src/lib/worktree";
import { dialogAtom } from "src/state/dialog";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { projectSettingsAtom } from "src/state/project-settings";
import { momentLogAtom } from "src/state/model-changes";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { worktreeAtom } from "src/state/scenarios";
import { splitsAtom, defaultSplits } from "src/state/layout";
import { mapSyncMomentAtom } from "src/state/map";
import {
  nodeSymbologyAtom,
  linkSymbologyAtom,
  savedSymbologiesAtom,
  propertyColorConfigAtom,
  defaultPropertyColorConfigs,
  nodeSizeAtom,
} from "src/state/map-symbology";
import { nullSymbologySpec, defaultNodeSizeConfig } from "src/map/symbology";
import { modeAtom, Mode } from "src/state/mode";
import {
  ephemeralStateAtom,
  pipeDrawingDefaultsAtom,
  autoElevationsAtom,
} from "src/state/drawing";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { branchStateAtom } from "src/state/branch-state";
import {
  sourceRebuildDurationsAtom,
  resultsFetchDurationsAtom,
} from "src/state/performance";
import {
  initialPlaybackState,
  simulationPlaybackAtom,
} from "src/state/simulation-playback";
import { zonesAtom } from "src/state/zones";
import { pipeMaterialsAtom } from "src/state/pipe-library";
import { hglProfileAtom, hglProfileOpenAtom } from "src/state/hgl-profile";
import { bottomActiveTabAtom } from "src/state/panel-layout";

export type ProjectLoadInput = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  projectSettings: ProjectSettings;
  pipeLibrary?: PipeMaterial[];
  zones?: Zones;
  simulationSettings: SimulationSettings;
  autoElevations?: boolean;
};

export const resetAppState = (set: Setter) => {
  set(splitsAtom, defaultSplits);
  set(selectionAtom, USelection.none());
  set(mapSyncMomentAtom, { pointer: -1, version: 0 });
  set(nodeSymbologyAtom, nullSymbologySpec.node);
  set(linkSymbologyAtom, nullSymbologySpec.link);
  set(savedSymbologiesAtom, new Map());
  set(propertyColorConfigAtom, defaultPropertyColorConfigs);
  set(nodeSizeAtom, defaultNodeSizeConfig);
  set(modeAtom, { mode: Mode.NONE });
  set(hglProfileAtom, null);
  set(hglProfileOpenAtom, false);
  set(bottomActiveTabAtom, null);
  set(ephemeralStateAtom, { type: "none" });
  set(pipeDrawingDefaultsAtom, {});
  set(autoElevationsAtom, true);
  set(sourceRebuildDurationsAtom, []);
  set(resultsFetchDurationsAtom, []);
  set(simulationPlaybackAtom, initialPlaybackState);
  set(zonesAtom, initializeZones());
  set(pipeMaterialsAtom, []);
};

export const loadModel = (
  set: Setter,
  input: ProjectLoadInput,
): ProjectSettings => {
  const {
    hydraulicModel,
    factories,
    projectSettings,
    zones,
    simulationSettings,
    autoElevations,
  } = input;
  const momentLog = new MomentLog(hydraulicModel.version);

  set(stagingModelAtom, hydraulicModel);
  set(baseModelAtom, hydraulicModel);
  set(modelFactoriesAtom, factories);
  const mergedProjectSettings: ProjectSettings = {
    ...projectSettings,
    units: {
      ...projectSettings.units,
      chemicalConcentration: simulationSettings.qualityMassUnit,
    },
  };
  set(projectSettingsAtom, mergedProjectSettings);
  set(zonesAtom, zones ?? initializeZones());
  set(momentLogAtom, momentLog);
  set(simulationSettingsAtom, simulationSettings);
  set(pipeMaterialsAtom, input.pipeLibrary ?? []);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  set(worktreeAtom, initializeWorktree());

  set(
    branchStateAtom,
    new Map([
      [
        "main",
        {
          version: hydraulicModel.version,
          hydraulicModel,
          labelManager: factories.labelManager,
          momentLog,
          simulation: null,
          simulationSourceId: "main",
          simulationSettings,
          simulationResults: null,
        },
      ],
    ]),
  );

  return mergedProjectSettings;
};

export const clearSimulationStorage = async () => {
  const storage = new OPFSStorage(getAppId());
  await storage.clear();
};

export const useStartNewProject = () => {
  const startNewProject = useAtomCallback(
    useCallback(async (_get: Getter, set: Setter, input: ProjectLoadInput) => {
      await clearSimulationStorage();
      const mergedProjectSettings: ProjectSettings = {
        ...input.projectSettings,
        units: {
          ...input.projectSettings.units,
          chemicalConcentration: input.simulationSettings.qualityMassUnit,
        },
      };
      await db.importProject({
        newDb: true,
        projectSettings: mergedProjectSettings,
        hydraulicModel: input.hydraulicModel,
        simulationSettings: input.simulationSettings,
      });
      resetAppState(set);
      loadModel(set, input);
    }, []),
  );

  return { startNewProject };
};

export const useSeedDefaultProjectDb = () => {
  return useAtomCallback(
    useCallback((get: Getter, set: Setter) => {
      const projectSettings = get(projectSettingsAtom);
      const hydraulicModel = get(stagingModelAtom);
      const simulationSettings = get(simulationSettingsAtom);

      resetAppState(set);
      loadModel(set, {
        hydraulicModel,
        factories: get(modelFactoriesAtom),
        projectSettings,
        simulationSettings,
      });

      void db
        .importProject({
          newDb: true,
          projectSettings,
          hydraulicModel,
          simulationSettings,
        })
        .catch((e: unknown) => {
          const error = e instanceof Error ? e : new Error(String(e));
          captureWarning("Failed to seed default project db", error);
          set(dialogAtom, {
            type: "appLoadFailed",
            errorMessage: error.message,
          });
        });
    }, []),
  );
};
