import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";

export const useIsBranchLocked = () => {
  const worktree = useAtomValue(worktreeAtom);
  const activeBranch = worktree.branches.get(worktree.activeBranchId);
  return activeBranch?.status === "locked";
};
