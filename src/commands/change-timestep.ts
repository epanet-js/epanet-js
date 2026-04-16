import { useAtom } from "jotai";
import { useCallback } from "react";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { simulationStepAtom } from "src/state/simulation";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

type ChangeTimestepSource = "shortcut" | "buttons" | "dropdown" | "quick-graph";

export const useChangeTimestep = () => {
  const [simulationStep, setSimulationStep] = useAtom(simulationStepAtom);
  const [simulation, setSimulationState] = useAtom(simulationDerivedAtom);

  const userTracking = useUserTracking();

  const changeTimestep = useCallback(
    (timestepIndex: number, source: ChangeTimestepSource) => {
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

        setSimulationStep(newTimeStep);

        userTracking.capture({
          name: "simulation.timestep.changed",
          timestepIndex,
          source,
        });
      } catch (error) {
        captureError(error as Error);
        setSimulationStep(null);
        setSimulationState({ status: "idle" });
      }
    },
    [
      simulationStep,
      simulation,
      setSimulationStep,
      userTracking,
      setSimulationState,
    ],
  );

  const goToPreviousTimestep = useCallback(
    (source: ChangeTimestepSource = "shortcut") => {
      const currentIndex = simulationStep ?? 0;
      changeTimestep(currentIndex - 1, source);
    },
    [simulationStep, changeTimestep],
  );

  const goToNextTimestep = useCallback(
    (source: ChangeTimestepSource = "shortcut") => {
      const currentIndex = simulationStep ?? 0;
      changeTimestep(currentIndex + 1, source);
    },
    [simulationStep, changeTimestep],
  );

  return { changeTimestep, goToPreviousTimestep, goToNextTimestep };
};
