import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import { mapSyncMomentAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom, autoElevationsAtom } from "src/state/drawing";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { modelCacheAtom } from "src/state/model-cache";
import { modelFactoriesAtom } from "src/state/model-factories";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initializeWorktree } from "src/lib/worktree";
import { worktreeAtom } from "src/state/scenarios";

type ReprojectionResetInput = {
  hydraulicModel: HydraulicModel;
  projectSettings: ProjectSettings;
  autoElevations?: boolean;
};

const resetAppState = (set: Setter) => {
  set(mapSyncMomentAtom, { pointer: -1, version: 0 });
  set(simulationDerivedAtom, initialSimulationState);
  set(modeAtom, { mode: Mode.NONE });
  set(ephemeralStateAtom, { type: "none" });
  set(selectionAtom, { type: "none" });
};

const clearSimulationStorage = async () => {
  const storage = new OPFSStorage(getAppId());
  await storage.clear();
};

const loadModel = (
  get: Getter,
  set: Setter,
  { hydraulicModel, projectSettings, autoElevations }: ReprojectionResetInput,
) => {
  const simulationSettings = get(simulationSettingsDerivedAtom);
  const momentLog = new MomentLog();

  set(stagingModelDerivedAtom, hydraulicModel);
  set(projectSettingsAtom, projectSettings);
  set(momentLogDerivedAtom, momentLog);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  set(
    worktreeAtom,
    initializeWorktree({
      momentLog,
      version: hydraulicModel.version,
      simulationSettings,
    }),
  );

  const factories = get(modelFactoriesAtom);
  set(
    modelCacheAtom,
    new Map([
      ["main", { model: hydraulicModel, labelManager: factories.labelManager }],
    ]),
  );
};

export const useReprojectionReset = () => {
  const reprojectionReset = useAtomCallback(
    useCallback(
      async (get: Getter, set: Setter, input: ReprojectionResetInput) => {
        await clearSimulationStorage();
        resetAppState(set);
        loadModel(get, set, input);
      },
      [],
    ),
  );

  return { reprojectionReset };
};
