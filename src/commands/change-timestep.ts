import { useAtomCallback } from "jotai/utils";
import { simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { setTimestepAtom } from "src/state/simulation-step";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";
import { useTogglePlayback } from "src/commands/toggle-playback";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

export type ChangeTimestepSource =
  | "shortcut"
  | "buttons"
  | "dropdown"
  | "quick-graph";

export const useChangeTimestep = () => {
  const userTracking = useUserTracking();
  const { stopPlayback } = useTogglePlayback();

  const changeTimestep = useAtomCallback(
    (get, set, timestepIndex: number, source: ChangeTimestepSource) => {
      try {
        const previousStep = get(simulationStepAtom);
        set(setTimestepAtom, timestepIndex);
        const newStep = get(simulationStepAtom);
        if (newStep !== null && newStep !== previousStep) {
          userTracking.capture({
            name: "simulation.timestep.changed",
            timestepIndex: newStep,
            source,
          });
        }
      } catch (error) {
        captureError(error as Error);
        set(simulationStepAtom, null);
        set(simulationDerivedAtom, { status: "idle" });
      }
    },
  );

  const goToPreviousTimestep = useAtomCallback(
    (get, _set, source: ChangeTimestepSource = "shortcut") => {
      stopPlayback(source);
      changeTimestep((get(simulationStepAtom) ?? 0) - 1, source);
    },
  );

  const goToNextTimestep = useAtomCallback(
    (get, _set, source: ChangeTimestepSource = "shortcut") => {
      stopPlayback(source);
      changeTimestep((get(simulationStepAtom) ?? 0) + 1, source);
    },
  );

  return { changeTimestep, goToPreviousTimestep, goToNextTimestep };
};
