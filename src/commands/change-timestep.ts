import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  currentTimestepIndexAtom,
  simulationAtom,
  simulationStepAtom,
} from "src/state/simulation";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const simulation = useAtomValue(simulationAtom);
  const setSimulationState = useSetAtom(simulationAtom);
  const userTracking = useUserTracking();
  const setSimulationStep = useSetAtom(simulationStepAtom);
  const currentTimestepIndex = useAtomValue(currentTimestepIndexAtom);

  const epsResultsReader =
    simulation.status === "success" || simulation.status === "warning"
      ? simulation.epsResultsReader
      : undefined;

  const changeTimestep = useCallback(
    async (timestepIndex: number, source: ChangeTimestepSource) => {
      if (!epsResultsReader) return;
      if (
        timestepIndex < 0 ||
        timestepIndex >= epsResultsReader.timestepCount
      ) {
        return;
      }

      try {
        const resultsReader =
          await epsResultsReader.getResultsForTimestep(timestepIndex);

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
    [epsResultsReader, setSimulationStep, setSimulationState, userTracking],
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
