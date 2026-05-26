import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { branchStateAtom } from "src/state/branch-state";
import { useSwitchBranch } from "./use-switch-branch";

export const useDeleteBranch = () => {
  const { switchBranch } = useSwitchBranch();

  const deleteBranch = useAtomCallback(
    useCallback(
      (
        get: Getter,
        set: Setter,
        branchId: string,
        switchToId: string | null,
      ) => {
        if (switchToId) {
          switchBranch(switchToId);
        }

        const branchStates = new Map(get(branchStateAtom));
        branchStates.delete(branchId);
        set(branchStateAtom, branchStates);
      },
      [switchBranch],
    ),
  );

  return { deleteBranch };
};
