import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";

export const useIsCustomerAllocationDisabled = () => {
  const worktree = useAtomValue(worktreeAtom);

  return worktree.scenarios.length > 0;
};
