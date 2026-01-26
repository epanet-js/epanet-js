import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { worktreeAtom } from "src/state/scenarios";

export const useIsMainReadonly = () => {
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const worktree = useAtomValue(worktreeAtom);
  const mainSnapshot = worktree.snapshots.get(worktree.mainId);

  return (
    isScenariosOn &&
    mainSnapshot?.status === "locked" &&
    worktree.activeSnapshotId === worktree.mainId
  );
};
