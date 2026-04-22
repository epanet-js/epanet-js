import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import { mapSyncMomentAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom, autoElevationsAtom } from "src/state/drawing";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
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

const loadModel = async (
  get: Getter,
  set: Setter,
  { hydraulicModel, projectSettings, autoElevations }: ReprojectionResetInput,
  isOurFileOn: boolean,
) => {
  const momentLog = new MomentLog();

  set(stagingModelDerivedAtom, hydraulicModel);
  set(projectSettingsAtom, projectSettings);
  if (isOurFileOn) {
    await db.saveProjectSettings(projectSettings);
    await db.setAllAssets(hydraulicModel.assets);
    await db.setAllCustomerPoints(
      hydraulicModel.customerPoints,
      hydraulicModel.demands.customerPoints,
    );
    await db.setAllPatterns(hydraulicModel.patterns);
    await db.setAllCurves(hydraulicModel.curves);
    await db.setAllControls(hydraulicModel.controls);
    await db.setAllSimulationSettings(get(simulationSettingsAtom));
    await db.setAllJunctionDemands(hydraulicModel.demands.junctions);
  }
  set(momentLogDerivedAtom, momentLog);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  set(worktreeAtom, initializeWorktree());
};

export const useReprojectionReset = () => {
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const reprojectionReset = useAtomCallback(
    useCallback(
      async (get: Getter, set: Setter, input: ReprojectionResetInput) => {
        await clearSimulationStorage();
        resetAppState(set);
        await loadModel(get, set, input, isOurFileOn);
      },
      [isOurFileOn],
    ),
  );

  return { reprojectionReset };
};
