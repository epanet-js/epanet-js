import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { getBranchStore } from "src/lib/branching";
import { writeQueue } from "src/lib/persistence/write-queue";
import { branchStateAtom, isBranchLoaded } from "src/state/branch-state";
import { modelFactoriesAtom } from "src/state/model-factories";
import { nullTrace, type Trace } from "src/infra/trace";
import { getMainState, materializeBranch } from "./use-initialize-branch";

export const useLoadBranch = () => {
  const loadBranch = useAtomCallback(
    useCallback(
      async (
        get: Getter,
        set: Setter,
        branchId: string,
        trace: Trace = nullTrace,
      ) => {
        const state = get(branchStateAtom).get(branchId);
        if (!state) {
          throw new Error(`Branch state not found for ${branchId}`);
        }
        if (isBranchLoaded(state)) return;

        await trace.measureAsync("wait-writes", () => writeQueue.whenIdle());
        const delta = await trace.measureAsync("read-delta", () =>
          getBranchStore().loadDelta(branchId),
        );

        const branchStates = get(branchStateAtom);
        const unloaded = branchStates.get(branchId);
        if (!unloaded || isBranchLoaded(unloaded)) return;

        const updated = new Map(branchStates);
        updated.set(
          branchId,
          materializeBranch(
            getMainState(get),
            get(modelFactoriesAtom),
            unloaded,
            delta,
            trace,
          ),
        );
        trace.measure("commit", () => set(branchStateAtom, updated));
      },
      [],
    ),
  );

  return { loadBranch };
};
