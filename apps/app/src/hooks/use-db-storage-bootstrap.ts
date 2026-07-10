import { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { dbPoolExists } from "@epanet-js/ejsdb";
import { useSeedDefaultProjectDb } from "src/hooks/persistence/use-start-new-project";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { configureDbStorage } from "src/lib/db/commands/configure-storage";
import {
  recoverableSessionAtom,
  sessionRecoveryActiveAtom,
} from "src/state/session-recovery";
import {
  readRecoveryFingerprint,
  clearRecoveryFingerprint,
} from "src/infra/session-recovery";

export const useDbStorageBootstrap = (isEnabled: boolean): boolean => {
  const [isDbReady, setIsDbReady] = useState(false);
  const seedDefaultProjectDb = useSeedDefaultProjectDb();
  const isDbInOpfsOn = useFeatureFlag("FLAG_DB_IN_OPFS");
  const isSessionRecoveryOn = useFeatureFlag("FLAG_SESSION_RECOVERY");
  const setSessionRecoveryActive = useSetAtom(sessionRecoveryActiveAtom);
  const setRecoverableSession = useSetAtom(recoverableSessionAtom);
  const userTracking = useUserTracking();
  const dbInitializedRef = useRef(false);

  useEffect(() => {
    if (dbInitializedRef.current) return;
    if (!isEnabled) return;
    dbInitializedRef.current = true;

    const bootstrap = async () => {
      try {
        const effective = await configureDbStorage(
          isDbInOpfsOn,
          isSessionRecoveryOn,
        );
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
      } catch (error) {
        captureError(error as Error);
      }

      await seedDefaultProjectDb();
    };

    void bootstrap().finally(() => {
      setIsDbReady(true);
    });
  }, [
    isEnabled,
    seedDefaultProjectDb,
    isDbInOpfsOn,
    isSessionRecoveryOn,
    setSessionRecoveryActive,
    setRecoverableSession,
    userTracking,
  ]);

  return isDbReady;
};
