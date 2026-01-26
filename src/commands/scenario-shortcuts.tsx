import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom } from "src/state/scenarios";

export const toggleSnapshotShortcut = "y";
export const goToMainShortcut = "shift+y";

export const useToggleSnapshot = () => {
  const worktree = useAtomValue(worktreeAtom);
  const { switchToSnapshot } = useScenarioOperations();

  return useCallback(() => {
    const hasScenarios = worktree.scenarios.length > 0;
    if (!hasScenarios) {
      return;
    }

    if (worktree.activeSnapshotId !== worktree.lastActiveSnapshotId) {
      switchToSnapshot(worktree.lastActiveSnapshotId);
    } else {
      const firstScenarioId = worktree.scenarios[0];
      if (firstScenarioId) {
        switchToSnapshot(firstScenarioId);
      }
    }
  }, [worktree, switchToSnapshot]);
};

export const useGoToMain = () => {
  const worktree = useAtomValue(worktreeAtom);
  const { switchToMain } = useScenarioOperations();

  return useCallback(() => {
    if (worktree.activeSnapshotId !== worktree.mainId) {
      switchToMain();
    }
  }, [worktree, switchToMain]);
};
