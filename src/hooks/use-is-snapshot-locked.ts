import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { worktreeAtom } from "src/state/scenarios";

export const useIsSnapshotLocked = () => {
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const worktree = useAtomValue(worktreeAtom);
  const activeSnapshot = worktree.snapshots.get(worktree.activeSnapshotId);

  return isScenariosOn && activeSnapshot?.status === "locked";
};
