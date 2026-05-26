import { atom } from "jotai";
import { simulationStepAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";

export const setTimestepAtom = atom(null, (get, set, timestepIndex: number) => {
  const simDerived = get(simulationDerivedAtom);
  const epsReader =
    "epsResultsReader" in simDerived ? simDerived.epsResultsReader : undefined;
  if (!epsReader || epsReader.timestepCount < 1) {
    set(simulationStepAtom, null);
    return;
  }

  const newTimeStep = Math.max(
    0,
    Math.min(timestepIndex, epsReader.timestepCount - 1),
  );
  set(simulationStepAtom, newTimeStep);
});
