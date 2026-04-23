import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ModelFactories } from "src/hydraulic-model/factories";
import type { ProjectSettings } from "src/lib/project-settings";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initializeWorktree } from "src/lib/worktree";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { modelFactoriesAtom } from "src/state/model-factories";
import { projectSettingsAtom } from "src/state/project-settings";
import { momentLogAtom } from "src/state/model-changes";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { worktreeAtom } from "src/state/scenarios";
import { splitsAtom, defaultSplits } from "src/state/layout";
import { dataAtom, nullData } from "src/state/data";
import { mapSyncMomentAtom } from "src/state/map";
import {
  nodeSymbologyAtom,
  linkSymbologyAtom,
  savedSymbologiesAtom,
  propertyColorConfigAtom,
  defaultPropertyColorConfigs,
} from "src/state/map-symbology";
import { nullSymbologySpec } from "src/map/symbology";
import { modeAtom, Mode } from "src/state/mode";
import {
  ephemeralStateAtom,
  pipeDrawingDefaultsAtom,
  autoElevationsAtom,
} from "src/state/drawing";
import { selectionAtom } from "src/state/selection";
import { branchStateAtom } from "src/state/branch-state";
import {
  sourceRebuildDurationsAtom,
  resultsFetchDurationsAtom,
} from "src/state/performance";
import { simulationPlaybackAtom } from "src/state/simulation-playback";

export type ProjectLoadInput = {
  hydraulicModel: HydraulicModel;
  factories: ModelFactories;
  projectSettings: ProjectSettings;
  simulationSettings: SimulationSettings;
  autoElevations?: boolean;
};

export const resetAppState = (set: Setter) => {
  set(splitsAtom, defaultSplits);
  set(dataAtom, nullData);
  set(mapSyncMomentAtom, { pointer: -1, version: 0 });
  set(nodeSymbologyAtom, nullSymbologySpec.node);
  set(linkSymbologyAtom, nullSymbologySpec.link);
  set(savedSymbologiesAtom, new Map());
  set(propertyColorConfigAtom, defaultPropertyColorConfigs);
  set(modeAtom, { mode: Mode.NONE });
  set(ephemeralStateAtom, { type: "none" });
  set(selectionAtom, { type: "none" });
  set(pipeDrawingDefaultsAtom, {});
  set(autoElevationsAtom, true);
  set(sourceRebuildDurationsAtom, []);
  set(resultsFetchDurationsAtom, []);
  set(simulationPlaybackAtom, (prev) => ({ ...prev, playingAtSpeedMs: 0 }));
};

export const loadModel = (
  set: Setter,
  input: ProjectLoadInput,
): ProjectSettings => {
  const {
    hydraulicModel,
    factories,
    projectSettings,
    simulationSettings,
    autoElevations,
  } = input;
  const momentLog = new MomentLog();

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
  set(momentLogAtom, momentLog);
  set(simulationSettingsAtom, simulationSettings);
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
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const startNewProject = useAtomCallback(
    useCallback(
      async (_get: Getter, set: Setter, input: ProjectLoadInput) => {
        await clearSimulationStorage();
        resetAppState(set);
        const mergedProjectSettings = loadModel(set, input);
        if (isOurFileOn) {
          void db
            .importProject({
              newDb: true,
              projectSettings: mergedProjectSettings,
              hydraulicModel: input.hydraulicModel,
              simulationSettings: input.simulationSettings,
            })
            .catch(captureError);
        }
      },
      [isOurFileOn],
    ),
  );

  return { startNewProject };
};
