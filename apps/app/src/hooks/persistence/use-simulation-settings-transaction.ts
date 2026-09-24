import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import type { Getter } from "jotai";
import { nanoid } from "nanoid";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { projectDataVersionAtom } from "src/state/project-revision";
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
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const useSimulationSettingsTransaction = () => {
  const setSettings = useSetAtom(simulationSettingsDerivedAtom);
  const setProjectDataVersion = useSetAtom(projectDataVersionAtom);
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();
  const isPersistScenariosOn = useFeatureFlag("FLAG_PERSIST_SCENARIOS");

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
        if (!isPersistScenariosOn) {
          setProjectDataVersion(nanoid());
        }

        const worktree = get(worktreeAtom);
        if (worktree.activeBranchId === worktree.mainId) {
          writeQueue.enqueue(
            () => setAllSimulationSettings(data),
            onWriteFailure,
          );
        } else if (isPersistScenariosOn) {
          const branchId = worktree.activeBranchId;
          writeQueue.enqueue(
            () => getBranchStore().recordSimulationSettings(branchId, data),
            onWriteFailure,
          );
        }

        return true;
      },
      [
        setSettings,
        setProjectDataVersion,
        setDialog,
        onWriteFailure,
        isPersistScenariosOn,
      ],
    ),
  );

  return { transact };
};
