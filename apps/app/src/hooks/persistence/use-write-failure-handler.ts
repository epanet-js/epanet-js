import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { exportDb } from "src/lib/db";
import { projectFileInfoAtom } from "src/state/file-system";
import { sessionRecoveryActiveAtom } from "src/state/session-recovery";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { notify } from "src/components/notifications";
import { WarningIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useOpenPersistedProject } from "src/hooks/persistence/use-open-persisted-project";

export const useWriteFailureHandler = (): ((error: unknown) => void) => {
  const { openPersistedProject } = useOpenPersistedProject();
  const translate = useTranslate();

  const recover = useAtomCallback(
    useCallback(
      async (get: Getter) => {
        try {
          const info = get(projectFileInfoAtom);
          const blob = await exportDb();
          const file = new File(
            [blob],
            info?.name ?? translate("recoveredModelName"),
          );
          const result = await openPersistedProject({ file });
          if (result.status !== "ok") {
            throw new Error(`openPersistedProject status: ${result.status}`);
          }
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
        }
      },
      [openPersistedProject, translate],
    ),
  );

  return useAtomCallback(
    useCallback(
      (get: Getter, _set: Setter, error: unknown) => {
        if (!get(sessionRecoveryActiveAtom)) {
          throw error;
        }

        captureWarning(
          "DB write failed; recovering model from persisted DB",
          error instanceof Error ? error : new Error(String(error)),
        );

        notify({
          variant: "warning",
          size: "md",
          Icon: WarningIcon,
          title: translate("writeFailedRecoveredTitle"),
          description: translate("writeFailedRecoveredDescription"),
        });

        void recover();
      },
      [recover, translate],
    ),
  );
};
