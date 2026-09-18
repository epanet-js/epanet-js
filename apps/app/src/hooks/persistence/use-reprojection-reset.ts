import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import { handleError } from "src/infra/errors";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "@epanet-js/project-settings";
import { mapEditionsTrackerAtom } from "src/state/map";
import { initialSimulationState } from "src/state/simulation";
import {
  stagingModelDerivedAtom,
  sessionHistoryDerivedAtom,
  simulationDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { modeAtom, Mode } from "src/state/mode";
import { ephemeralStateAtom, autoElevationsAtom } from "src/state/drawing";
import { OPFSStorage, opfsUnavailableErrors } from "src/infra/storage";
import { getAppId } from "src/infra/app-instance";
import { SessionHistory } from "src/lib/persistence/session-history";
import { MapEditionsTracker } from "src/map/map-editions-tracker";
import { initializeWorktree } from "@epanet-js/worktree";
import { worktreeAtom } from "src/state/scenarios";
import { modelFactoriesAtom } from "src/state/model-factories";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { idPoolsToPersist } from "src/lib/id-pools";

type ReprojectionResetInput = {
  hydraulicModel: HydraulicModel;
  projectSettings: ProjectSettings;
  autoElevations?: boolean;
};

const resetAppState = (set: Setter) => {
  set(mapEditionsTrackerAtom, new MapEditionsTracker());
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
  { hydraulicModel, projectSettings, autoElevations }: ReprojectionResetInput,
  withIdPools: boolean,
) => {
  const sessionHistory = new SessionHistory(hydraulicModel.version);

  set(stagingModelDerivedAtom, hydraulicModel);
  set(projectSettingsAtom, projectSettings);
  void db
    .importProject({
      projectSettings,
      hydraulicModel,
      simulationSettings: get(simulationSettingsDerivedAtom),
      idPools: idPoolsToPersist(withIdPools, get(modelFactoriesAtom).idPools),
    })
    .catch((error) =>
      handleError(error, {
        as: "Reprojection reset: project import failed",
        warn: opfsUnavailableErrors,
        onUnexpected: "capture",
      }),
    );
  set(sessionHistoryDerivedAtom, sessionHistory);
  if (autoElevations !== undefined) {
    set(autoElevationsAtom, autoElevations);
  }

  set(worktreeAtom, initializeWorktree());
};

export const useReprojectionReset = () => {
  const isIdPoolsOn = useFeatureFlag("FLAG_ID_POOLS");
  const reprojectionReset = useAtomCallback(
    useCallback(
      async (get: Getter, set: Setter, input: ReprojectionResetInput) => {
        resetAppState(set);
        await clearSimulationStorage();
        loadModel(get, set, input, isIdPoolsOn);
      },
      [isIdPoolsOn],
    ),
  );

  return { reprojectionReset };
};
