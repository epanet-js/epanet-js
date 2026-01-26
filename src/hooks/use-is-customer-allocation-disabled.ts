import { useAtomValue } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { worktreeAtom } from "src/state/scenarios";

export const useIsCustomerAllocationDisabled = () => {
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const worktree = useAtomValue(worktreeAtom);

  return isScenariosOn && worktree.scenarios.length > 0;
};
