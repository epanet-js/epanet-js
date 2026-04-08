import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { branchStateAtom } from "src/state/branch-state";
import { useSwitchBranch } from "./use-switch-branch";

export const useDeleteBranch = () => {
  const { switchBranch } = useSwitchBranch();

  const deleteBranch = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        branchId: string,
        switchToId: string | null,
      ) => {
        if (switchToId) {
          await switchBranch(switchToId);
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
