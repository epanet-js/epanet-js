import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type { HydraulicModel } from "src/hydraulic-model";
import { mapSyncMomentAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { OPFSStorage } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { MomentLog } from "src/lib/persistence/moment-log";
import { initializeWorktree } from "src/lib/worktree";
import { worktreeAtom } from "src/state/scenarios";

type CustomerPointsImportResetInput = {
  hydraulicModel: HydraulicModel;
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
  set: Setter,
  { hydraulicModel }: CustomerPointsImportResetInput,
  isOurFileOn: boolean,
) => {
  const momentLog = new MomentLog();

  set(stagingModelDerivedAtom, hydraulicModel);
  if (isOurFileOn) {
    await db.setAllAssets(hydraulicModel.assets);
    await db.setAllCustomerPoints(
      hydraulicModel.customerPoints,
      hydraulicModel.demands.customerPoints,
    );
  }
  set(momentLogDerivedAtom, momentLog);

  set(worktreeAtom, initializeWorktree());
};

export const useCustomerPointsImportReset = () => {
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const customerPointsImportReset = useAtomCallback(
    useCallback(
      async (
        _get: Getter,
        set: Setter,
        input: CustomerPointsImportResetInput,
      ) => {
        await clearSimulationStorage();
        resetAppState(set);
        await loadModel(set, input, isOurFileOn);
      },
      [isOurFileOn],
    ),
  );

  return { customerPointsImportReset };
};
