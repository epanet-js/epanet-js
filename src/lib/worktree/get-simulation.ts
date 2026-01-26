import type { Worktree } from "./types";
import type { SimulationState } from "src/state/jotai";

export const getSimulationForState = (
  state: Worktree,
  initialSimulationState: SimulationState,
): SimulationState => {
  const activeSnapshot = state.snapshots.get(state.activeSnapshotId);
  return activeSnapshot?.simulation ?? initialSimulationState;
};
