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
  simulationResultsAtom,
} from "src/state/simulation";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { selectionAtom } from "src/state/selection";
import { projectSettingsAtom } from "src/state/project-settings";
import { getSimulationForState } from "src/lib/worktree";
import type { Worktree } from "src/lib/worktree/types";
import { USelection } from "src/selection";
import type { MomentLog } from "src/lib/persistence/moment-log";

function getModelFromCache(
  get: Getter,
  snapshotId: string,
): { model: HydraulicModel; labelManager: LabelManager } {
  const cache = get(modelCacheAtom);
  const cached = cache.get(snapshotId);
  if (!cached) {
    throw new Error(`Model cache miss for snapshot ${snapshotId}`);
  }
  return cached;
}

function switchMomentLog(get: Getter, set: Setter, momentLog: MomentLog): void {
  const current = get(mapSyncMomentAtom);
  set(momentLogAtom, momentLog);
  set(mapSyncMomentAtom, {
    pointer: momentLog.getPointer(),
    version: current.version + 1,
  });
}

async function loadSimulationResults(
  simulation: SimulationState,
  snapshotId: string,
  preserveTimestepIndex?: number,
): Promise<{
  resultsReader: Awaited<
    ReturnType<
      import("src/simulation").EPSResultsReader["getResultsForTimestep"]
    >
  > | null;
  actualTimestepIndex?: number;
}> {
  if (
    (simulation.status === "success" || simulation.status === "warning") &&
    simulation.metadata
  ) {
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

    let timestepIndex: number;
    if (preserveTimestepIndex !== undefined) {
      timestepIndex = Math.min(
        preserveTimestepIndex,
        epsReader.timestepCount - 1,
      );
    } else {
      timestepIndex = simulation.currentTimestepIndex ?? 0;
    }

    const resultsReader = await epsReader.getResultsForTimestep(timestepIndex);
    return { resultsReader, actualTimestepIndex: timestepIndex };
  }
  return { resultsReader: null };
}

type SimulationState = import("src/state/simulation").SimulationState;

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

        const currentSimulation = get(simulationAtom);
        const preserveTimestepIndex =
          currentSimulation.status === "success" ||
          currentSimulation.status === "warning"
            ? currentSimulation.currentTimestepIndex
            : undefined;

        const { model: stagingModel, labelManager: snapshotLabelManager } =
          getModelFromCache(get, snapshotId);
        const { model: baseModel } = getModelFromCache(get, worktree.mainId);

        const simulation = getSimulationForState(
          worktree,
          initialSimulationState,
        );
        const resultsSourceId = snapshot.simulationSourceId;
        const { resultsReader, actualTimestepIndex } =
          await loadSimulationResults(
            simulation,
            resultsSourceId,
            preserveTimestepIndex,
          );

        const finalSimulation =
          actualTimestepIndex !== undefined &&
          (simulation.status === "success" || simulation.status === "warning")
            ? { ...simulation, currentTimestepIndex: actualTimestepIndex }
            : simulation;

        const currentFactories = get(modelFactoriesAtom);
        set(stagingModelAtom, stagingModel);
        set(baseModelAtom, baseModel);
        set(
          modelFactoriesAtom,
          initializeModelFactories({
            idGenerator: currentFactories.idGenerator,
            labelManager: snapshotLabelManager,
            defaults: get(projectSettingsAtom).defaults,
            labelCounters: currentFactories.labelCounters,
          }),
        );
        switchMomentLog(get, set, snapshot.momentLog);
        set(simulationAtom, finalSimulation);
        set(simulationResultsAtom, resultsReader);
        set(simulationSettingsAtom, snapshot.simulationSettings);

        const selection = get(selectionAtom);
        const validatedSelection = USelection.clearInvalidIds(
          selection,
          stagingModel.assets,
          stagingModel.customerPoints,
        );
        set(selectionAtom, { ...validatedSelection });
      },
      [],
    ),
  );

  return { applySnapshot };
};
