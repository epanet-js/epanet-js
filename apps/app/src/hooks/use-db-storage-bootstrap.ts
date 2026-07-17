import { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { dbPoolExists } from "@epanet-js/ejsdb";
import { useSeedDefaultProjectDb } from "src/hooks/persistence/use-start-new-project";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { captureError } from "src/infra/error-tracking";
import { configureDbStorage } from "src/lib/db";
import {
  recoverableSessionsAtom,
  sessionRecoveryActiveAtom,
} from "src/state/session-recovery";
import {
  readRecoveryFingerprints,
  clearRecoveryFingerprints,
  type RecoveryFingerprint,
} from "src/infra/session-recovery";
import { isSessionAlive } from "src/infra/session-lock";

export const useDbStorageBootstrap = (isEnabled: boolean): boolean => {
  const [isDbReady, setIsDbReady] = useState(false);
  const seedDefaultProjectDb = useSeedDefaultProjectDb();
  const isWriteDbToOpfsOn = useFeatureFlag("FLAG_WRITE_DB_TO_OPFS");
  const isReadDbFromOpfsOn = useFeatureFlag("FLAG_READ_DB_FROM_OPFS");
  const isSessionRecoveryOn = useFeatureFlag("FLAG_SESSION_RECOVERY");
  const setSessionRecoveryActive = useSetAtom(sessionRecoveryActiveAtom);
  const setRecoverableSessions = useSetAtom(recoverableSessionsAtom);
  const userTracking = useUserTracking();
  const dbInitializedRef = useRef(false);

  useEffect(() => {
    if (dbInitializedRef.current) return;
    if (!isEnabled) return;
    dbInitializedRef.current = true;

    const bootstrap = async () => {
      try {
        const effective = await configureDbStorage(
          isWriteDbToOpfsOn,
          isReadDbFromOpfsOn,
          isSessionRecoveryOn,
        );
        const recoveryActive = isSessionRecoveryOn && effective === "sahpool";
        setSessionRecoveryActive(recoveryActive);

        if (recoveryActive) {
          const recoverable: RecoveryFingerprint[] = [];
          const stalePoolIds: string[] = [];
          for (const fingerprint of readRecoveryFingerprints()) {
            if (await isSessionAlive(fingerprint.poolId)) continue;
            if (await dbPoolExists(fingerprint.poolId)) {
              recoverable.push(fingerprint);
            } else {
              stalePoolIds.push(fingerprint.poolId);
            }
          }

          clearRecoveryFingerprints(stalePoolIds);

          if (recoverable.length > 0) {
            setRecoverableSessions(recoverable);
            userTracking.capture({ name: "sessionRecovery.offered" });
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
    isWriteDbToOpfsOn,
    isReadDbFromOpfsOn,
    isSessionRecoveryOn,
    setSessionRecoveryActive,
    setRecoverableSessions,
    userTracking,
  ]);

  return isDbReady;
};
