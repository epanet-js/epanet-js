import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { exportDb } from "src/lib/db";
import { projectFileInfoAtom } from "src/state/file-system";
import { dialogAtom, type DialogState } from "src/state/dialog";
import {
  dbAvailabilityAtom,
  rebuildAttemptsAtom,
  writesSucceededAtRebuildAtom,
  sessionRecoveryActiveAtom,
  MAX_REBUILD_ATTEMPTS,
} from "src/state/session-recovery";
import { addToErrorLog } from "src/infra/error-tracking";
import { clearRecoveryFingerprint } from "src/infra/session-recovery";
import { getAppId } from "src/infra/app-instance";
import { writeQueue } from "src/lib/persistence/write-queue";
import { notify } from "src/components/notifications";
import { WarningIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { useOpenPersistedProject } from "src/hooks/persistence/use-open-persisted-project";
import type { OpenPersistedProjectPhase } from "src/hooks/persistence/use-open-persisted-project";
import { withProgressDialog } from "src/dialogs/progress-dialog";
import { useRebuildDb } from "src/hooks/persistence/use-rebuild-db";

const unreadableDbErrors = [
  "No database open",
  "SQLITE_IOERR",
  "SQLITE_CANTOPEN",
  "SQLITE_CORRUPT",
  "SQLITE_NOTADB",
  "SQLITE_READONLY",
];

const isDbUnreadable = (error: unknown): boolean => {
  const text =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return unreadableDbErrors.some((marker) => text.includes(marker));
};

const describeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const useWriteFailureHandler = (): ((error: unknown) => void) => {
  const { openPersistedProject } = useOpenPersistedProject();
  const translate = useTranslate();
  const rebuildDb = useRebuildDb();

  const recover = useAtomCallback(
    useCallback(
      async (get: Getter, set: Setter) => {
        try {
          const info = get(projectFileInfoAtom);
          const blob = await exportDb();
          const file = new File(
            [blob],
            info?.name ?? translate("recoveredModelName"),
          );
          const { result, wasShown } = await withProgressDialog(
            (state: DialogState) => set(dialogAtom, state),
            "opening" as OpenPersistedProjectPhase,
            (phase: OpenPersistedProjectPhase) => ({
              type: "openProjectProgress" as const,
              phase,
            }),
            (onProgress) => openPersistedProject({ file, onProgress }),
          );
          if (result.status !== "ok") {
            throw new Error(`openPersistedProject status: ${result.status}`);
          }
          set(dbAvailabilityAtom, "available");
          if (wasShown) set(dialogAtom, null);
          notify({
            variant: "warning",
            size: "md",
            Icon: WarningIcon,
            title: translate("writeFailedRecoveredTitle"),
            description: translate("writeFailedRecoveredDescription"),
          });
        } catch (error) {
          addToErrorLog({
            category: "db",
            level: "warning",
            message: "DB reload failed; rebuilding from memory",
            data: { error: describeError(error).message },
          });
          await rebuildDb();
        }
      },
      [openPersistedProject, translate, rebuildDb],
    ),
  );

  return useAtomCallback(
    useCallback(
      (get: Getter, set: Setter, error: unknown) => {
        if (get(dbAvailabilityAtom) !== "available") return;

        if (isDbUnreadable(error)) {
          const recoveredSinceRebuild =
            writeQueue.succeededCount() > get(writesSucceededAtRebuildAtom);
          if (recoveredSinceRebuild) set(rebuildAttemptsAtom, 0);

          if (get(rebuildAttemptsAtom) >= MAX_REBUILD_ATTEMPTS) {
            set(dbAvailabilityAtom, "unavailable");
            set(dialogAtom, { type: "dbUnavailable" });
            addToErrorLog({
              category: "db",
              level: "error",
              message: "DB still unwritable after rebuilding; giving up",
              data: { error: describeError(error).message },
            });
            return;
          }

          set(dbAvailabilityAtom, "rebuilding");
          clearRecoveryFingerprint(getAppId());
          addToErrorLog({
            category: "db",
            level: "warning",
            message: "DB unreadable; rebuilding project storage",
            data: { error: describeError(error).message },
          });
          void rebuildDb();
          return;
        }

        if (!get(sessionRecoveryActiveAtom)) {
          throw error;
        }

        set(dbAvailabilityAtom, "recovering");
        addToErrorLog({
          category: "db",
          level: "warning",
          message: "DB write failed; recovering model from persisted DB",
          data: { error: describeError(error).message },
        });

        void recover();
      },
      [recover, rebuildDb],
    ),
  );
};
