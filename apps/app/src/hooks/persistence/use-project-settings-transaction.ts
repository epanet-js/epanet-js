import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { ProjectSettings } from "src/lib/project-settings";
import { projectSettingsAtom } from "src/state/project-settings";
import { dialogAtom } from "src/state/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { saveProjectSettings, serializeProjectSettings } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useProjectSettingsTransaction = () => {
  const setProjectSettings = useSetAtom(projectSettingsAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isSchemaFirstOn = useFeatureFlag("FLAG_SCHEMA_FIRST");

  const transact = useCallback(
    async (next: ProjectSettings): Promise<boolean> => {
      if (isSchemaFirstOn) {
        try {
          serializeProjectSettings(next);
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
          setDialog({ type: "changeNotApplied" });
          return false;
        }
      }

      setProjectSettings(next);

      await saveProjectSettings(next);

      return true;
    },
    [setProjectSettings, setDialog, isSchemaFirstOn],
  );

  return { transact };
};
