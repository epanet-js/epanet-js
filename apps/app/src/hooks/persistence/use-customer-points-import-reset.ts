import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { nanoid } from "nanoid";
import * as db from "src/lib/db";
import { handleError } from "src/infra/errors";
import type { HydraulicModel } from "src/hydraulic-model";
import { mapEditionsTrackerAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  momentLogDerivedAtom,
  sessionHistoryDerivedAtom,
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
import { SessionHistory } from "src/lib/persistence/session-history";
import { MapEditionsTracker } from "src/map/map-editions-tracker";
import { initializeWorktree } from "@epanet-js/worktree";
import { worktreeAtom } from "src/state/scenarios";

type CustomerPointsImportResetInput = {
  hydraulicModel: HydraulicModel;
};

const resetAppState = (set: Setter) => {
  set(simulationDerivedAtom, initialSimulationState);
  set(mapEditionsTrackerAtom, new MapEditionsTracker());
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
  const importedModel = { ...hydraulicModel, version: nanoid() };
  const momentLog = new MomentLog(importedModel.version);
  const sessionHistory = new SessionHistory(importedModel.version);

  set(stagingModelDerivedAtom, importedModel);
  void db
    .importProject({
      hydraulicModel: importedModel,
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
  set(sessionHistoryDerivedAtom, sessionHistory);

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
