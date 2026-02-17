import { useAtomValue } from "jotai";
import { worktreeAtom } from "src/state/scenarios";
import { isUnprojectedAtom } from "src/state/jotai";

export const useIsCustomerAllocationDisabled = () => {
  const worktree = useAtomValue(worktreeAtom);
  const isUnprojected = useAtomValue(isUnprojectedAtom);

  return worktree.scenarios.length > 0 || isUnprojected;
};
