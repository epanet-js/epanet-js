import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  currentTimestepIndexAtom,
  simulationAtom,
  simulationStepAtom,
} from "src/state/simulation";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";
import { useGetEpsResultsReader } from "src/hooks/use-eps-results-reader";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const simulation = useAtomValue(simulationAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const userTracking = useUserTracking();
  const getEpsResultsReader = useGetEpsResultsReader();
  const setSimulationStep = useSetAtom(simulationStepAtom);
  const currentTimestepIndex = useAtomValue(currentTimestepIndexAtom);

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

        setSimulationStep({
          resultsReader,
          currentTimestepIndex: timestepIndex,
        });

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
      setSimulationStep,
      setSimulationState,
      userTracking,
      getEpsResultsReader,
    ],
  );

  const goToPreviousTimestep = useCallback(
    async (source: ChangeTimestepSource = "shortcut") => {
      await changeTimestep((currentTimestepIndex ?? 0) - 1, source);
    },
    [currentTimestepIndex, changeTimestep],
  );

  const goToNextTimestep = useCallback(
    async (source: ChangeTimestepSource = "shortcut") => {
      await changeTimestep((currentTimestepIndex ?? 0) + 1, source);
    },
    [currentTimestepIndex, changeTimestep],
  );

  return { changeTimestep, goToPreviousTimestep, goToNextTimestep };
};
