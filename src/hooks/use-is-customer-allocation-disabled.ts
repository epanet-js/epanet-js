import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { isMainLocked } from "src/lib/worktree";

export const useIsCustomerAllocationDisabled = () => {
  const worktree = useAtomValue(worktreeAtom);

  return isMainLocked(worktree);
};
