import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import { useGetEpsResultsReader } from "src/hooks/use-eps-results-reader";
import { usePersistenceWithSnapshots } from "src/lib/persistence";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const simulation = useAtomValue(simulationAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const userTracking = useUserTracking();
  const getEpsResultsReader = useGetEpsResultsReader();
  const persistence = usePersistenceWithSnapshots();
  const setSimulationResults = useSetAtom(simulationResultsAtom);

  const changeTimestep = useCallback(
    async (timestepIndex: number, source: ChangeTimestepSource) => {
      if (simulation.status !== "success" && simulation.status !== "warning") {
        return;
      }

      const { metadata } = simulation;
      if (!metadata) {
        return;
      }

      const timestepCount = getSimulationMetadata(metadata).reportingStepsCount;
      if (timestepIndex < 0 || timestepIndex >= timestepCount) {
        return;
      }

      try {
        const epsReader = await getEpsResultsReader();
        if (!epsReader) return;

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
      getEpsResultsReader,
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
