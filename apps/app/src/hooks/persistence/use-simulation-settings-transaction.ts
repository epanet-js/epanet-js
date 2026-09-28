import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import type { Getter } from "jotai";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import { worktreeAtom } from "src/state/scenarios";
import {
  setAllSimulationSettings,
  serializeSimulationSettings,
} from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { getBranchStore } from "src/lib/branching";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useSimulationSettingsTransaction = () => {
  const setSettings = useSetAtom(simulationSettingsDerivedAtom);
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();

  const transact = useAtomCallback(
    useCallback(
      (get: Getter, _set, next: SimulationSettings): boolean => {
        let data: string;
        try {
          data = serializeSimulationSettings(next);
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
          setDialog({ type: "changeNotApplied" });
          return false;
        }

        setSettings(next);

        const worktree = get(worktreeAtom);
        if (worktree.activeBranchId === worktree.mainId) {
          writeQueue.enqueue(
            () => setAllSimulationSettings(data),
            onWriteFailure,
          );
        } else {
          const branchId = worktree.activeBranchId;
          writeQueue.enqueue(
            () => getBranchStore().recordSimulationSettings(branchId, data),
            onWriteFailure,
          );
        }

        return true;
      },
      [setSettings, setDialog, onWriteFailure],
    ),
  );

  return { transact };
};
