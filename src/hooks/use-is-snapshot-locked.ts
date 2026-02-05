import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";

export const useIsSnapshotLocked = () => {
  const worktree = useAtomValue(worktreeAtom);
  const activeSnapshot = worktree.snapshots.get(worktree.activeSnapshotId);

  return activeSnapshot?.status === "locked";
};
