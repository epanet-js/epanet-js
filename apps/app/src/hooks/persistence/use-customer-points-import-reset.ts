import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import type { HydraulicModel } from "src/hydraulic-model";
import { mapSyncMomentAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
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
  set(selectionAtom, USelection.none());
};

const clearSimulationStorage = async () => {
  const storage = new OPFSStorage(getAppId());
  await storage.clear();
};

const loadModel = (
  get: Getter,
  set: Setter,
  { hydraulicModel }: CustomerPointsImportResetInput,
) => {
  const momentLog = new MomentLog(hydraulicModel.version);

  set(stagingModelDerivedAtom, hydraulicModel);
  void db
    .importProject({
      hydraulicModel,
      simulationSettings: get(simulationSettingsDerivedAtom),
    })
    .catch(captureError);
  set(momentLogDerivedAtom, momentLog);

  set(worktreeAtom, initializeWorktree());
};

export const useCustomerPointsImportReset = () => {
  const customerPointsImportReset = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        input: CustomerPointsImportResetInput,
      ) => {
        await clearSimulationStorage();
        resetAppState(set);
        loadModel(get, set, input);
      },
      [],
    ),
  );

  return { customerPointsImportReset };
};
