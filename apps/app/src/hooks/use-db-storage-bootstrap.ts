import { useEffect, useRef } from "react";
import { useSetAtom } from "jotai";
import { dbPoolExists } from "@epanet-js/ejsdb";
import { useSeedDefaultProjectDb } from "src/hooks/persistence/use-start-new-project";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { configureDbStorage } from "src/lib/db/commands/configure-storage";
import {
  recoverableSessionAtom,
  sessionRecoveryActiveAtom,
  sessionRecoveryResolvedAtom,
} from "src/state/session-recovery";
import {
  readRecoveryFingerprint,
  clearRecoveryFingerprint,
} from "src/infra/session-recovery";

export const useDbStorageBootstrap = (isReady: boolean): void => {
  const seedDefaultProjectDb = useSeedDefaultProjectDb();
  const isDbInOpfsOn = useFeatureFlag("FLAG_DB_IN_OPFS");
  const isSessionRecoveryOn = useFeatureFlag("FLAG_SESSION_RECOVERY");
  const setSessionRecoveryActive = useSetAtom(sessionRecoveryActiveAtom);
  const setRecoverableSession = useSetAtom(recoverableSessionAtom);
  const setSessionRecoveryResolved = useSetAtom(sessionRecoveryResolvedAtom);
  const userTracking = useUserTracking();
  const dbInitializedRef = useRef(false);

  useEffect(() => {
    if (dbInitializedRef.current) return;
    if (!isReady) return;
    dbInitializedRef.current = true;
    void configureDbStorage(isDbInOpfsOn, isSessionRecoveryOn)
      .then(async (effective) => {
        const recoveryActive = isSessionRecoveryOn && effective === "sahpool";
        setSessionRecoveryActive(recoveryActive);

        if (recoveryActive) {
          const fingerprint = readRecoveryFingerprint();
          if (fingerprint) {
            if (await dbPoolExists(fingerprint.poolId)) {
              setRecoverableSession(fingerprint);
              userTracking.capture({ name: "sessionRecovery.offered" });
            } else {
              clearRecoveryFingerprint();
            }
          }
        }

        seedDefaultProjectDb();
      })
      .finally(() => {
        setSessionRecoveryResolved(true);
      });
  }, [
    isReady,
    seedDefaultProjectDb,
    isDbInOpfsOn,
    isSessionRecoveryOn,
    setSessionRecoveryActive,
    setRecoverableSession,
    setSessionRecoveryResolved,
    userTracking,
  ]);
};
