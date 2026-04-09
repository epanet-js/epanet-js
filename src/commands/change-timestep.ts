import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import {
  simulationAtom,
  simulationResultsAtom,
  simulationStepAtom,
} from "src/state/simulation";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { useGetEpsResultsReader } from "src/hooks/use-eps-results-reader";
import { getSimulationMetadata } from "src/simulation/epanet/simulation-metadata";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const [simulationStep, setSimulationStep] = useAtom(simulationStepAtom);
  const setSimulationState = useSetAtom(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );
  const simulation = useAtomValue(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );
  const setSimulationResults = useSetAtom(
    isStateRefactorOn ? simulationResultsDerivedAtom : simulationResultsAtom,
  );
  const timestepCount =
    "metadata" in simulation
      ? getSimulationMetadata(simulation.metadata).reportingStepsCount
      : 0;

  const userTracking = useUserTracking();
  const getEpsResultsReader = useGetEpsResultsReader();

  const changeTimestep = useCallback(
    async (timestepIndex: number, source: ChangeTimestepSource) => {
      try {
        if (simulationStep === null)
          throw new Error("Unknown simulation steps");
        if (timestepCount === 0) throw new Error("No simulation steps");

        const newTimeStep = Math.max(
          0,
          Math.min(timestepIndex, timestepCount - 1),
        );

        const epsReader = await getEpsResultsReader();
        if (!epsReader) throw new Error("Unknown simulation results");

        const resultsReader =
          await epsReader.getResultsForTimestep(newTimeStep);

        setSimulationStep(newTimeStep);
        setSimulationResults(resultsReader);

        userTracking.capture({
          name: "simulation.timestep.changed",
          timestepIndex,
          source,
        });
      } catch (error) {
        captureError(error as Error);
        setSimulationStep(null);
        setSimulationState({ status: "idle" });
        setSimulationResults(null);
      }
    },
    [
      simulationStep,
      timestepCount,
      getEpsResultsReader,
      setSimulationStep,
      setSimulationResults,
      userTracking,
      setSimulationState,
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
