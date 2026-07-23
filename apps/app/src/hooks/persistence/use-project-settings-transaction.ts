import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import { dialogAtom } from "src/state/dialog";
import { saveProjectSettings, serializeProjectSettings } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useProjectSettingsTransaction = () => {
  const setProjectSettings = useSetAtom(projectSettingsAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isQueueOn = useFeatureFlag("FLAG_TRANSACTIONS_QUEUE");
  const onWriteFailure = useWriteFailureHandler();

  const transact = useCallback(
    async (next: ProjectSettings): Promise<boolean> => {
      try {
        serializeProjectSettings(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      setProjectSettings(next);

      if (isQueueOn) {
        writeQueue.enqueue(() => saveProjectSettings(next), onWriteFailure);
      } else {
        await saveProjectSettings(next);
      }

      return true;
    },
    [setProjectSettings, setDialog, isQueueOn, onWriteFailure],
  );

  return { transact };
};
