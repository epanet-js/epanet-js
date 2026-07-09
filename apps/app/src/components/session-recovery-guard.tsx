import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { hasUnsavedChangesDerivedAtom } from "src/state/derived-branch-state";
import { projectFileInfoAtom } from "src/state/file-system";
import { sessionRecoveryActiveAtom } from "src/state/session-recovery";
import { getAppId } from "src/infra/app-instance";
import {
  writeRecoveryFingerprint,
  readRecoveryFingerprint,
  clearRecoveryFingerprint,
} from "src/infra/session-recovery";

export const SessionRecoveryGuard = () => {
  const isActive = useAtomValue(sessionRecoveryActiveAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesDerivedAtom);
  const projectName = useAtomValue(projectFileInfoAtom)?.name ?? null;

  useEffect(() => {
    if (!isActive) return;

    if (hasUnsavedChanges) {
      writeRecoveryFingerprint({
        poolId: getAppId(),
        projectName,
        timestamp: Date.now(),
      });
    } else {
      clearOwnFingerprint();
    }
  }, [isActive, hasUnsavedChanges, projectName]);

  useEffect(() => {
    if (!isActive) return;

    const handlePageHide = () => clearOwnFingerprint();
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isActive]);

  return null;
};

const clearOwnFingerprint = (): void => {
  const fingerprint = readRecoveryFingerprint();
  if (fingerprint && fingerprint.poolId === getAppId()) {
    clearRecoveryFingerprint();
  }
};
