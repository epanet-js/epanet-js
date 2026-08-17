import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { handleError } from "src/infra/errors";
import type { HydraulicModel } from "src/hydraulic-model";
import { mapSyncMomentAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  changeTrackerDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom } from "src/state/drawing";
import { OPFSStorage, opfsUnavailableErrors } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { MomentLog } from "src/lib/persistence/moment-log";
import { ChangeTracker } from "src/lib/persistence/change-tracker";
import { initializeWorktree } from "src/lib/worktree";
import { worktreeAtom } from "src/state/scenarios";

type CustomerPointsImportResetInput = {
  hydraulicModel: HydraulicModel;
};

const resetAppState = (set: Setter) => {
  set(simulationDerivedAtom, initialSimulationState);
  set(mapSyncMomentAtom, { pointer: -1, version: 0 });
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
    .catch((error) =>
      handleError(error, {
        as: "Customer points import reset: project import failed",
        warn: opfsUnavailableErrors,
        onUnexpected: "capture",
      }),
    );
  set(momentLogDerivedAtom, momentLog);
  set(changeTrackerDerivedAtom, new ChangeTracker());

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
        resetAppState(set);
        await clearSimulationStorage();
        loadModel(get, set, input);
      },
      [],
    ),
  );

  return { customerPointsImportReset };
};
