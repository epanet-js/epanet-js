import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom } from "src/state/scenarios";
import { getScenarios, isMainBranch } from "src/lib/worktree";

export const toggleSnapshotShortcut = "y";
export const goToMainShortcut = "shift+y";

export const useToggleSnapshot = () => {
  const worktree = useAtomValue(worktreeAtom);
  const { switchToSnapshot } = useScenarioOperations();

  return useCallback(() => {
    const scenarios = getScenarios(worktree);
    if (scenarios.length === 0) {
      return;
    }

    if (worktree.activeBranchId !== worktree.lastActiveBranchId) {
      switchToSnapshot(worktree.lastActiveBranchId);
    } else {
      const firstScenario = scenarios[0];
      if (firstScenario) {
        switchToSnapshot(firstScenario.id);
      }
    }
  }, [worktree, switchToSnapshot]);
};

export const useGoToMain = () => {
  const worktree = useAtomValue(worktreeAtom);
  const { switchToMain } = useScenarioOperations();

  return useCallback(() => {
    if (!isMainBranch(worktree.activeBranchId)) {
      switchToMain();
    }
  }, [worktree, switchToMain]);
};
