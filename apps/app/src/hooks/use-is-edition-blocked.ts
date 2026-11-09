import { useAtomValue } from "jotai";
import { useIsBranchLocked } from "src/hooks/use-is-branch-locked";
import { usePermissions } from "src/hooks/use-permissions";
import { isPlayingAtom } from "src/state/simulation-playback";
import { historyPendingAtom } from "src/state/transactions";
import { worktreeAtom } from "src/state/scenarios";

export type EditionBlock =
  | "branchLocked"
  | "playing"
  | "historyPending"
  | "scenarioReadOnly";

export const useEditionBlock = (): EditionBlock | null => {
  const isBranchLocked = useIsBranchLocked();
  const isPlaying = useAtomValue(isPlayingAtom);
  const isHistoryPending = useAtomValue(historyPendingAtom);
  const worktree = useAtomValue(worktreeAtom);
  const { canUseScenarios } = usePermissions();
  const isScenarioReadOnly =
    worktree.activeBranchId !== worktree.mainId && !canUseScenarios;
  if (isBranchLocked) return "branchLocked";
  if (isPlaying) return "playing";
  if (isHistoryPending) return "historyPending";
  if (isScenarioReadOnly) return "scenarioReadOnly";
  return null;
};

export const useIsEditionBlocked = () => useEditionBlock() !== null;
