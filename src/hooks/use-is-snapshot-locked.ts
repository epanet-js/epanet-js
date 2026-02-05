import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { isMainLocked, isMainBranch } from "src/lib/worktree";

export const useIsSnapshotLocked = () => {
  const worktree = useAtomValue(worktreeAtom);

  // Main is locked if scenarios exist
  if (isMainBranch(worktree.activeBranchId)) {
    return isMainLocked(worktree);
  }

  return false;
};
