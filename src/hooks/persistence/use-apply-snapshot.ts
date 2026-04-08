import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import type { HydraulicModel } from "src/hydraulic-model";
import { initializeModelFactories } from "src/hydraulic-model/factories";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { modelFactoriesAtom } from "src/state/model-factories";
import { modelCacheAtom } from "src/state/model-cache";
import { stagingModelAtom, baseModelAtom } from "src/state/hydraulic-model";
import { momentLogAtom } from "src/state/model-changes";
import { mapSyncMomentAtom } from "src/state/map";
import {
  simulationAtom,
  initialSimulationState,
  simulationStepAtom,
  currentTimestepIndexAtom,
  type SimulationStep,
} from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { getSimulationForState } from "src/lib/worktree";
import type { Worktree } from "src/lib/worktree/types";
import { USelection } from "src/selection";
import type { MomentLog } from "src/lib/persistence/moment-log";

type SimulationState = import("src/state/simulation").SimulationState;

function getModelsFromCache(
  get: Getter,
  snapshotId: string,
  mainId: string,
): {
  stagingModel: HydraulicModel;
  baseModel: HydraulicModel;
  labelManager: LabelManager;
} {
  const cache = get(modelCacheAtom);
  const snapshotEntry = cache.get(snapshotId);
  if (!snapshotEntry) {
    throw new Error(`Model cache miss for snapshot ${snapshotId}`);
  }
  const mainEntry = cache.get(mainId);
  if (!mainEntry) {
    throw new Error(`Model cache miss for snapshot ${mainId}`);
  }
  return {
    stagingModel: snapshotEntry.model,
    baseModel: mainEntry.model,
    labelManager: snapshotEntry.labelManager,
  };
}

function setModelState(
  get: Getter,
  set: Setter,
  stagingModel: HydraulicModel,
  baseModel: HydraulicModel,
  labelManager: LabelManager,
): void {
  const currentFactories = get(modelFactoriesAtom);
  set(stagingModelAtom, stagingModel);
  set(baseModelAtom, baseModel);
  set(
    modelFactoriesAtom,
    initializeModelFactories({
      idGenerator: currentFactories.idGenerator,
      labelManager,
      defaults: get(projectSettingsAtom).defaults,
      labelCounters: currentFactories.labelCounters,
    }),
  );
}

function switchMomentLog(get: Getter, set: Setter, momentLog: MomentLog): void {
  const current = get(mapSyncMomentAtom);
  set(momentLogAtom, momentLog);
  set(mapSyncMomentAtom, {
    pointer: momentLog.getPointer(),
    version: current.version + 1,
  });
}

function setSimulationState(
  set: Setter,
  simulation: SimulationState,
  simulationStep: SimulationStep | null,
  simulationSettings: import("src/simulation/simulation-settings").SimulationSettings,
): void {
  set(simulationAtom, simulation);
  set(simulationStepAtom, simulationStep);
  set(simulationSettingsAtom, simulationSettings);
}

function validateSelection(
  get: Getter,
  set: Setter,
  model: HydraulicModel,
): void {
  const selection = get(selectionAtom);
  const validatedSelection = USelection.clearInvalidIds(
    selection,
    model.assets,
    model.customerPoints,
  );
  set(selectionAtom, { ...validatedSelection });
}

async function prepareSimulation(
  get: Getter,
  worktree: Worktree,
  snapshot: NonNullable<ReturnType<Worktree["snapshots"]["get"]>>,
): Promise<{
  finalSimulation: SimulationState;
  simulationStep: SimulationStep | null;
}> {
  const preserveTimestepIndex = get(currentTimestepIndexAtom) ?? undefined;

  const simulation = getSimulationForState(worktree, initialSimulationState);
  const simulationStep = await fetchSimulationStep(
    simulation,
    snapshot.simulationSourceId,
    preserveTimestepIndex,
  );

  return { finalSimulation: simulation, simulationStep: simulationStep };
}

async function fetchSimulationStep(
  simulation: SimulationState,
  snapshotId: string,
  preserveTimestepIndex?: number,
): Promise<SimulationStep | null> {
  if (
    (simulation.status !== "success" && simulation.status !== "warning") ||
    !simulation.metadata
  ) {
    return null;
  }

  const [{ OPFSStorage }, { EPSResultsReader }, { getAppId }] =
    await Promise.all([
      import("src/infra/storage"),
      import("src/simulation"),
      import("src/infra/app-instance"),
    ]);

  const appId = getAppId();
  const storage = new OPFSStorage(appId, snapshotId);
  const epsReader = new EPSResultsReader(storage);
  await epsReader.initialize(simulation.metadata, simulation.simulationIds);

  const currentTimestepIndex =
    preserveTimestepIndex !== undefined
      ? Math.min(preserveTimestepIndex, epsReader.timestepCount - 1)
      : 0;

  const resultsReader =
    await epsReader.getResultsForTimestep(currentTimestepIndex);
  return { resultsReader, currentTimestepIndex };
}

export const useApplySnapshot = () => {
  const applySnapshot = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        worktree: Worktree,
        snapshotId: string,
      ) => {
        const snapshot = worktree.snapshots.get(snapshotId);
        if (!snapshot) return;

        const { finalSimulation, simulationStep } = await prepareSimulation(
          get,
          worktree,
          snapshot,
        );
        const { stagingModel, baseModel, labelManager } = getModelsFromCache(
          get,
          snapshotId,
          worktree.mainId,
        );

        setModelState(get, set, stagingModel, baseModel, labelManager);
        switchMomentLog(get, set, snapshot.momentLog);
        setSimulationState(
          set,
          finalSimulation,
          simulationStep,
          snapshot.simulationSettings,
        );
        validateSelection(get, set, stagingModel);
      },
      [],
    ),
  );

  return { applySnapshot };
};
