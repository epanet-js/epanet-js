import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import { rebuildDbFromMemory, type RebuildPhase } from "src/lib/db";
import {
  captureError,
  captureWarning,
  addToErrorLog,
} from "src/infra/error-tracking";
import { collectDbDiagnostics } from "src/lib/db/commands/collect-diagnostics";
import { dialogAtom, type DialogState } from "src/state/dialog";
import { withProgressDialog } from "src/dialogs/progress-dialog";
import { zonesAtom } from "src/state/zones";
import { projectSettingsAtom } from "src/state/project-settings";
import {
  stagingModelDerivedAtom,
  simulationSettingsDerivedAtom,
} from "src/state/derived-branch-state";
import {
  dbAvailabilityAtom,
  dbStorageModeAtom,
  rebuildAttemptsAtom,
  writesSucceededAtRebuildAtom,
  opfsReinstallFailedAtom,
} from "src/state/session-recovery";
import { withDatabaseBusy } from "src/hooks/persistence/use-start-new-project";
import { writeQueue } from "src/lib/persistence/write-queue";

export const useRebuildDb = (): (() => Promise<void>) =>
  useAtomCallback(
    useCallback(async (get: Getter, set: Setter) => {
      set(dbAvailabilityAtom, "rebuilding");

      const attempts = get(rebuildAttemptsAtom);
      set(rebuildAttemptsAtom, attempts + 1);
      set(writesSucceededAtRebuildAtom, writeQueue.succeededCount());
      const skipOpfs = get(opfsReinstallFailedAtom);
      const wasOnOpfs = get(dbStorageModeAtom) === "opfs";

      try {
        const { result: storageMode, wasShown } = await withProgressDialog(
          (state: DialogState) => set(dialogAtom, state),
          "storage" as RebuildPhase,
          (phase: RebuildPhase) => ({
            type: "rebuildStorageProgress" as const,
            phase,
          }),
          (onPhase) =>
            withDatabaseBusy(() =>
              rebuildDbFromMemory(
                {
                  zones: get(zonesAtom),
                  projectSettings: get(projectSettingsAtom),
                  hydraulicModel: get(stagingModelDerivedAtom),
                  simulationSettings: get(simulationSettingsDerivedAtom),
                },
                { skipOpfs, onPhase },
              ),
            ),
        );

        if (storageMode === null) {
          throw new Error("DB rebuild skipped: another load is in progress");
        }

        if (!skipOpfs && storageMode === "memory") {
          set(opfsReinstallFailedAtom, true);
        }

        set(dbStorageModeAtom, storageMode);
        set(dbAvailabilityAtom, "available");

        const lostCrashRecovery = storageMode === "memory" && wasOnOpfs;
        if (lostCrashRecovery) {
          set(dialogAtom, {
            type: "rebuildStorageProgress",
            phase: "finalizing",
            outcome: "memory",
          });
        } else if (wasShown) {
          set(dialogAtom, null);
        }
        addToErrorLog({
          category: "db",
          level: "info",
          message: `DB rebuilt from memory (${storageMode})`,
        });

        if (attempts === 0) {
          captureWarning(
            "DB storage degraded; rebuilt from memory",
            undefined,
            {
              "DB Storage": { storageMode, lostCrashRecovery },
            },
          );
        }
      } catch (error) {
        set(dbAvailabilityAtom, "unavailable");
        set(dialogAtom, { type: "dbUnavailable" });

        const diagnostics = await collectDbDiagnostics().catch(() => null);
        captureError(
          error instanceof Error ? error : new Error(String(error)),
          diagnostics
            ? { "DB Storage": { ...diagnostics } as Record<string, unknown> }
            : undefined,
        );
      }
    }, []),
  );
