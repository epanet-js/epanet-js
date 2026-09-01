import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useSetAtom } from "jotai";
import type { Getter } from "jotai";
import { cleanupStaleDbPools } from "@epanet-js/ejsdb";
import * as db from "src/lib/db";
import { getAppId } from "src/infra/app-instance";
import { recoverableSessionsAtom } from "src/state/session-recovery";
import { dialogAtom } from "src/state/dialog";
import {
  clearRecoveryFingerprints,
  readRecoveryFingerprints,
  type RecoveryFingerprint,
} from "src/infra/session-recovery";
import { isSessionAlive } from "src/infra/session-lock";
import { useOpenProjectFile } from "./open-project";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { WarningIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { captureError, captureWarning } from "src/infra/error-tracking";
import { formatErrorDetails } from "src/lib/errors";

export const useRecoverSession = () => {
  const openProjectFile = useOpenProjectFile();
  const setRecoverableSessions = useSetAtom(recoverableSessionsAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return useAtomCallback(
    useCallback(
      async (get: Getter, _set, fingerprint: RecoveryFingerprint) => {
        const offeredCount = get(recoverableSessionsAtom).length;

        setRecoverableSessions([]);
        setDialogState({ type: "loading" });

        let recoveredBlob: Blob | null = null;
        try {
          recoveredBlob = await db.exportDbFromPool(fingerprint.poolId);
        } catch (error) {
          captureError(
            new Error(
              `sessionRecovery export failed: ${formatErrorDetails(error)}`,
              { cause: error },
            ),
          );
        }

        if (!recoveredBlob) {
          clearRecoveryFingerprints([fingerprint.poolId]);
          discardRecoverablePools();
          setDialogState({ type: "welcome" });
          notify({
            variant: "warning",
            size: "md",
            title: translate("recoverUnsavedModelFailedTitle"),
            description: translate("recoverUnsavedModelFailedDescription"),
            Icon: WarningIcon,
          });
          userTracking.capture({ name: "sessionRecovery.failed" });
          return;
        }

        const name = fingerprint.projectName ?? translate("recoveredModelName");
        const file = new File([recoveredBlob], name);

        await openProjectFile(file, "recovery", {
          isUnsaved: true,
          lastSavedAt: fingerprint.timestampLastSave,
        });

        clearRecoveryFingerprints([fingerprint.poolId]);
        discardRecoverablePools();
        userTracking.capture({
          name: "sessionRecovery.recovered",
          count: offeredCount,
        });
      },
      [
        openProjectFile,
        setRecoverableSessions,
        setDialogState,
        userTracking,
        translate,
      ],
    ),
  );
};

export const useIgnoreRecoverableSessions = () => {
  const setRecoverableSessions = useSetAtom(recoverableSessionsAtom);
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get: Getter) => {
        const offeredCount = get(recoverableSessionsAtom).length;
        setRecoverableSessions([]);
        userTracking.capture({
          name: "sessionRecovery.ignored",
          count: offeredCount,
        });
      },
      [setRecoverableSessions, userTracking],
    ),
  );
};

export const useDiscardRecoverableSession = () => {
  const setRecoverableSessions = useSetAtom(recoverableSessionsAtom);
  const userTracking = useUserTracking();

  return useAtomCallback(
    useCallback(
      (get: Getter) => {
        const recoverablePoolIds = get(recoverableSessionsAtom).map(
          (session) => session.poolId,
        );
        setRecoverableSessions([]);
        clearRecoveryFingerprints(recoverablePoolIds);
        discardRecoverablePools();
        userTracking.capture({ name: "sessionRecovery.discarded" });
      },
      [setRecoverableSessions, userTracking],
    ),
  );
};

const discardRecoverablePools = (): void => {
  const survivingPoolIds = readRecoveryFingerprints().map(
    (fingerprint) => fingerprint.poolId,
  );
  void cleanupStaleDbPools(getAppId(), survivingPoolIds, isSessionAlive).catch(
    (error) => captureWarning("Stale DB pool cleanup failed (discard)", error),
  );
};
