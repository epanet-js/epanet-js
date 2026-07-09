import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useSetAtom } from "jotai";
import type { Getter } from "jotai";
import { cleanupStaleDbPools } from "@epanet-js/ejsdb";
import * as db from "src/lib/db";
import { getAppId } from "src/infra/app-instance";
import { recoverableSessionAtom } from "src/state/session-recovery";
import { clearRecoveryFingerprint } from "src/infra/session-recovery";
import { useOpenProjectFile } from "./open-project";
import { useUserTracking } from "src/infra/user-tracking";
import { notify } from "src/components/notifications";
import { WarningIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";
import { captureError } from "src/infra/error-tracking";
import { formatErrorDetails } from "src/lib/errors";

export const useRecoverSession = () => {
  const openProjectFile = useOpenProjectFile();
  const setRecoverable = useSetAtom(recoverableSessionAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return useAtomCallback(
    useCallback(
      async (get: Getter) => {
        const fingerprint = get(recoverableSessionAtom);
        if (!fingerprint) return;

        setRecoverable(null);

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
          clearRecoveryFingerprint();
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

        await openProjectFile(file, "recovery", { isUnsaved: true });

        void cleanupStaleDbPools(getAppId());
        userTracking.capture({ name: "sessionRecovery.recovered" });
      },
      [openProjectFile, setRecoverable, userTracking, translate],
    ),
  );
};

export const useDiscardRecoverableSession = () => {
  const setRecoverable = useSetAtom(recoverableSessionAtom);
  const userTracking = useUserTracking();

  return useCallback(() => {
    setRecoverable(null);
    clearRecoveryFingerprint();
    void cleanupStaleDbPools(getAppId());
    userTracking.capture({ name: "sessionRecovery.discarded" });
  }, [setRecoverable, userTracking]);
};
