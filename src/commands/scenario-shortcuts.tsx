import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom } from "src/state/scenarios";
import { isPlayingAtom } from "src/state/simulation-playback";

export const toggleBranchShortcut = "y";
export const goToMainShortcut = "shift+y";

export const useToggleBranch = () => {
  const worktree = useAtomValue(worktreeAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const { switchToBranch } = useScenarioOperations();

  return useCallback(() => {
    if (isPlaying) return;
    const hasScenarios = worktree.scenarios.length > 0;
    if (!hasScenarios) {
      return;
    }

    if (worktree.activeBranchId !== worktree.lastActiveBranchId) {
      switchToBranch(worktree.lastActiveBranchId);
    } else {
      const firstScenarioId = worktree.scenarios[0];
      if (firstScenarioId) {
        switchToBranch(firstScenarioId);
      }
    }
  }, [worktree, isPlaying, switchToBranch]);
};

export const useGoToMain = () => {
  const worktree = useAtomValue(worktreeAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const { switchToMain } = useScenarioOperations();

  return useCallback(() => {
    if (isPlaying) return;
    if (worktree.activeBranchId !== worktree.mainId) {
      switchToMain();
    }
  }, [worktree, isPlaying, switchToMain]);
};
