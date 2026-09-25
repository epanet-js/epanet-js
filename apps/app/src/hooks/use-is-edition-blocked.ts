import { useAtomValue } from "jotai";
import { useIsBranchLocked } from "src/hooks/use-is-branch-locked";
import { usePermissions } from "src/hooks/use-permissions";
import { isPlayingAtom } from "src/state/simulation-playback";
import { historyPendingAtom } from "src/state/transactions";
import { worktreeAtom } from "src/state/scenarios";

export const useIsEditionBlocked = () => {
  const isBranchLocked = useIsBranchLocked();
  const isPlaying = useAtomValue(isPlayingAtom);
  const isHistoryPending = useAtomValue(historyPendingAtom);
  const worktree = useAtomValue(worktreeAtom);
  const { canUseScenarios } = usePermissions();
  const isScenarioReadOnly =
    worktree.activeBranchId !== worktree.mainId && !canUseScenarios;
  return isBranchLocked || isPlaying || isHistoryPending || isScenarioReadOnly;
};
