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
import { SessionHistory } from "src/lib/persistence/session-history";
import { MapEditionsTracker } from "src/map/map-editions-tracker";
import { initializeWorktree } from "@epanet-js/worktree";
import { worktreeAtom } from "src/state/scenarios";
import { modelFactoriesAtom } from "src/state/model-factories";
import { initializeModelFactoriesWithPools } from "@epanet-js/hydraulic-model";
import { withPool, type IdGenerator } from "@epanet-js/id-generator";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { idPoolsToPersist } from "src/lib/id-pools";

type CustomerPointsImportResetInput = {
  hydraulicModel: HydraulicModel;
  idGenerator?: IdGenerator;
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
  { hydraulicModel, idGenerator }: CustomerPointsImportResetInput,
  withIdPools: boolean,
) => {
  const importedModel = { ...hydraulicModel, version: nanoid() };
  const sessionHistory = new SessionHistory(importedModel.version);

  if (idGenerator) {
    const factories = get(modelFactoriesAtom);
    set(
      modelFactoriesAtom,
      initializeModelFactoriesWithPools({
        idPools: withPool(factories.idPools, "customerPoint", idGenerator),
        labelManager: factories.labelManager,
        labelCounters: factories.labelCounters,
      }),
    );
  }

  set(stagingModelDerivedAtom, importedModel);
  void db
    .importProject({
      hydraulicModel: importedModel,
      simulationSettings: get(simulationSettingsDerivedAtom),
      idPools: idPoolsToPersist(withIdPools, get(modelFactoriesAtom).idPools),
    })
    .catch((error) =>
      handleError(error, {
        as: "Customer points import reset: project import failed",
        warn: opfsUnavailableErrors,
        onUnexpected: "capture",
      }),
    );
  set(sessionHistoryDerivedAtom, sessionHistory);

  set(worktreeAtom, initializeWorktree());
};

export const useCustomerPointsImportReset = () => {
  const isIdPoolsOn = useFeatureFlag("FLAG_ID_POOLS");
  const customerPointsImportReset = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        input: CustomerPointsImportResetInput,
      ) => {
        resetAppState(set);
        await clearSimulationStorage();
        loadModel(get, set, input, isIdPoolsOn);
      },
      [isIdPoolsOn],
    ),
  );

  return { customerPointsImportReset };
};
