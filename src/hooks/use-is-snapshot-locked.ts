import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";

export const useIsSnapshotLocked = () => {
  const worktree = useAtomValue(worktreeAtom);
  const activeBranch = worktree.branches.get(worktree.activeSnapshotId);
  if (activeBranch) return activeBranch.status === "locked";

  const activeSnapshot = worktree.snapshots.get(worktree.activeSnapshotId);
  return activeSnapshot?.status === "locked";
};
