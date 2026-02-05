import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { simulationAtom, simulationResultsAtom } from "src/state/jotai";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import { EPSResultsReader } from "src/simulation/epanet/eps-results-reader";
import { getAppId } from "src/infra/app-instance";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import { worktreeAtom } from "src/state/scenarios";
import { usePersistenceWithSnapshots } from "src/lib/persistence";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const simulation = useAtomValue(simulationAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const userTracking = useUserTracking();
  const worktree = useAtomValue(worktreeAtom);
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
        const scenarioKey = worktree.activeBranchId;
        const storage = new OPFSStorage(appId, scenarioKey);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata, simulationIds);

        const resultsReader =
          await epsReader.getResultsForTimestep(timestepIndex);

        setSimulationResults(resultsReader);

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
      setSimulationResults,
      setSimulationState,
      userTracking,
      worktree.activeBranchId,
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
