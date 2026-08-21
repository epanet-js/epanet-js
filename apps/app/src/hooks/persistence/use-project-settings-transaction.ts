import { useCallback } from "react";
import { useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import type { ProjectSettings } from "@epanet-js/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import { projectDataVersionAtom } from "src/state/project-revision";
import { dialogAtom } from "src/state/dialog";
import { saveProjectSettings, serializeProjectSettings } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";

export const useProjectSettingsTransaction = () => {
  const setProjectSettings = useSetAtom(projectSettingsAtom);
  const setProjectDataVersion = useSetAtom(projectDataVersionAtom);
  const setDialog = useSetAtom(dialogAtom);
  const onWriteFailure = useWriteFailureHandler();

  const transact = useCallback(
    (next: ProjectSettings): Promise<boolean> => {
      try {
        serializeProjectSettings(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return Promise.resolve(false);
      }

      setProjectSettings(next);
      setProjectDataVersion(nanoid());

      writeQueue.enqueue(() => saveProjectSettings(next), onWriteFailure);

      return Promise.resolve(true);
    },
    [setProjectSettings, setProjectDataVersion, setDialog, onWriteFailure],
  );

  return { transact };
};
