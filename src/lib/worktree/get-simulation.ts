import type { Worktree } from "./types";
import type { SimulationState } from "src/state/jotai";
import { getActiveBranch } from "./helpers";

export const getSimulationForState = (
  worktree: Worktree,
  initialSimulationState: SimulationState,
): SimulationState => {
  const activeBranch = getActiveBranch(worktree);
  return activeBranch?.simulation ?? initialSimulationState;
};
