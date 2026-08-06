import { atom } from "jotai";
import { simulationStepAtom, type SimulationState } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";

// Both writes land in one batch so simulationResultsAsyncDerivedAtom never
// recomputes against the incoming step paired with the outgoing reader, which
// would read from a run directory that is about to be deleted.
export const commitSimulationResultAtom = atom(
  null,
  (_get, set, simulationState: SimulationState) => {
    set(simulationDerivedAtom, simulationState);
    set(simulationStepAtom, 0);
  },
);

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
