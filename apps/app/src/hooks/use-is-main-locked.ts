import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";

export const useIsMainLocked = () => {
  const worktree = useAtomValue(worktreeAtom);
  return worktree.branches.get(worktree.mainId)?.status === "locked";
};
