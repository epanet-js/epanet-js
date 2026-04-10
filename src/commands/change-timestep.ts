import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import {
  simulationAtom,
  simulationResultsAtom,
  simulationStepAtom,
} from "src/state/simulation";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const [simulationStep, setSimulationStep] = useAtom(simulationStepAtom);
  const [simulation, setSimulationState] = useAtom(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );
  const setSimulationResults = useSetAtom(simulationResultsAtom);

  const userTracking = useUserTracking();

  const changeTimestep = useCallback(
    async (timestepIndex: number, source: ChangeTimestepSource) => {
      try {
        if (simulationStep === null)
          throw new Error("Unknown simulation steps");

        const epsReader =
          "epsResultsReader" in simulation
            ? simulation.epsResultsReader
            : undefined;
        if (!epsReader) throw new Error("Unknown simulation results");

        const timestepCount = epsReader.timestepCount;
        if (timestepCount === 0) throw new Error("No simulation steps");

        const newTimeStep = Math.max(
          0,
          Math.min(timestepIndex, timestepCount - 1),
        );

        const resultsReader =
          await epsReader.getResultsForTimestep(newTimeStep);

        setSimulationStep(newTimeStep);
        if (!isStateRefactorOn) setSimulationResults(resultsReader);

        userTracking.capture({
          name: "simulation.timestep.changed",
          timestepIndex,
          source,
        });
      } catch (error) {
        captureError(error as Error);
        setSimulationStep(null);
        setSimulationState({ status: "idle" });
        if (!isStateRefactorOn) setSimulationResults(null);
      }
    },
    [
      simulationStep,
      simulation,
      setSimulationStep,
      setSimulationResults,
      userTracking,
      setSimulationState,
      isStateRefactorOn,
    ],
  );

  const goToPreviousTimestep = useCallback(
    async (source: ChangeTimestepSource = "shortcut") => {
      const currentIndex = simulationStep ?? 0;
      await changeTimestep(currentIndex - 1, source);
    },
    [simulationStep, changeTimestep],
  );

  const goToNextTimestep = useCallback(
    async (source: ChangeTimestepSource = "shortcut") => {
      const currentIndex = simulationStep ?? 0;
      await changeTimestep(currentIndex + 1, source);
    },
    [simulationStep, changeTimestep],
  );

  return { changeTimestep, goToPreviousTimestep, goToNextTimestep };
};
