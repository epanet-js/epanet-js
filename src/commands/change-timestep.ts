import { useAtomCallback } from "jotai/utils";
import { simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { setTimestepAtom } from "src/state/simulation-step";
import { captureError } from "src/infra/error-tracking";
import { useUserTracking } from "src/infra/user-tracking";

export const previousTimestepShortcut = "shift+left";
export const nextTimestepShortcut = "shift+right";

export type ChangeTimestepSource =
  | "shortcut"
  | "buttons"
  | "dropdown"
  | "quick-graph";

export const useChangeTimestep = () => {
  const userTracking = useUserTracking();

  const changeTimestep = useAtomCallback(
    (_get, set, timestepIndex: number, source: ChangeTimestepSource) => {
      try {
        set(setTimestepAtom, timestepIndex);
        userTracking.capture({
          name: "simulation.timestep.changed",
          timestepIndex,
          source,
        });
      } catch (error) {
        captureError(error as Error);
        set(simulationStepAtom, null);
        set(simulationDerivedAtom, { status: "idle" });
      }
    },
  );

  const goToPreviousTimestep = useAtomCallback(
    (get, _set, source: ChangeTimestepSource = "shortcut") => {
      changeTimestep((get(simulationStepAtom) ?? 0) - 1, source);
    },
  );

  const goToNextTimestep = useAtomCallback(
    (get, _set, source: ChangeTimestepSource = "shortcut") => {
      changeTimestep((get(simulationStepAtom) ?? 0) + 1, source);
    },
  );

  return { changeTimestep, goToPreviousTimestep, goToNextTimestep };
};
