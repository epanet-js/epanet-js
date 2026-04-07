import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import {
  simulationAtom,
  initialSimulationState,
  simulationResultsAtom,
} from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom, autoElevationsAtom } from "src/state/drawing";
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
  set(simulationAtom, initialSimulationState);
  set(simulationResultsAtom, null);
  set(modeAtom, { mode: Mode.NONE });
  set(ephemeralStateAtom, { type: "none" });
  set(selectionAtom, { type: "none" });
};

const clearSimulationStorage = async () => {
  const [{ OPFSStorage }, { getAppId }] = await Promise.all([
    import("src/infra/storage"),
    import("src/infra/app-instance"),
  ]);
  const storage = new OPFSStorage(getAppId());
  await storage.clear();
};

const loadModel = (
  get: Getter,
  set: Setter,
  { hydraulicModel, projectSettings, autoElevations }: ReprojectionResetInput,
) => {
  const simulationSettings = get(simulationSettingsAtom);
  const momentLog = new MomentLog();

  set(stagingModelAtom, hydraulicModel);
  set(baseModelAtom, hydraulicModel);
  set(projectSettingsAtom, projectSettings);
  set(momentLogAtom, momentLog);
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
