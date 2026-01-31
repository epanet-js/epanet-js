import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  simulationAtom,
  simulationResultsAtom,
  stagingModelAtom,
} from "src/state/jotai";
import { attachSimulation } from "src/hydraulic-model";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import { buildSimulationKey } from "src/simulation/simulation-key";
import { getAppId } from "src/infra/app-instance";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import { worktreeAtom } from "src/state/scenarios";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { usePersistenceWithSnapshots } from "src/lib/persistence";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const simulation = useAtomValue(simulationAtom);
  const setHydraulicModel = useSetAtom(stagingModelAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const userTracking = useUserTracking();
  const worktree = useAtomValue(worktreeAtom);
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const isSimulationLoose = useFeatureFlag("FLAG_SIMULATION_LOOSE");
  const persistence = usePersistenceWithSnapshots();
  const setSimulationResults = useSetAtom(simulationResultsAtom);

  const changeTimestep = useCallback(
    async (timestepIndex: number, source: ChangeTimestepSource) => {
      if (simulation.status !== "success" && simulation.status !== "warning") {
        return;
      }

      const { metadata, simulationIds } = simulation;
      if (!metadata) {
        return;
      }

      const timestepCount = getSimulationMetadata(metadata).reportingStepsCount;
      if (timestepIndex < 0 || timestepIndex >= timestepCount) {
        return;
      }

      try {
        const appId = getAppId();
        const scenarioKey = isScenariosOn
          ? worktree.activeSnapshotId
          : undefined;
        const storageKey = isSimulationLoose
          ? buildSimulationKey(simulation.modelVersion)
          : scenarioKey;
        const storage = new OPFSStorage(appId, storageKey);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata, simulationIds);

        const resultsReader =
          await epsReader.getResultsForTimestep(timestepIndex);

        setSimulationResults(resultsReader);
        setHydraulicModel((prev) => attachSimulation(prev, resultsReader));

        const updatedSimulation = {
          ...simulation,
          currentTimestepIndex: timestepIndex,
        };
        setSimulationState(updatedSimulation);
        persistence.syncSnapshotSimulation(updatedSimulation);

        userTracking.capture({
          name: "simulation.timestep.changed",
          timestepIndex,
          source,
        });
      } catch (error) {
        captureError(error as Error);
        setSimulationState({ status: "idle" });
      }
    },
    [
      simulation,
      setHydraulicModel,
      setSimulationResults,
      setSimulationState,
      userTracking,
      isScenariosOn,
      isSimulationLoose,
      worktree.activeSnapshotId,
      persistence,
    ],
  );

  const goToPreviousTimestep = useCallback(
    async (source: ChangeTimestepSource = "shortcut") => {
      const currentIndex =
        "currentTimestepIndex" in simulation
          ? (simulation.currentTimestepIndex ?? 0)
          : 0;
      await changeTimestep(currentIndex - 1, source);
    },
    [simulation, changeTimestep],
  );

  const goToNextTimestep = useCallback(
    async (source: ChangeTimestepSource = "shortcut") => {
      const currentIndex =
        "currentTimestepIndex" in simulation
          ? (simulation.currentTimestepIndex ?? 0)
          : 0;
      await changeTimestep(currentIndex + 1, source);
    },
    [simulation, changeTimestep],
  );

  return { changeTimestep, goToPreviousTimestep, goToNextTimestep };
};
