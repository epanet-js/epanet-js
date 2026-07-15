import { useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  hasUnsavedChangesDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectFileInfoAtom } from "src/state/file-system";
import { sessionRecoveryActiveAtom } from "src/state/session-recovery";
import { getAppId } from "src/infra/app-instance";
import {
  writeRecoveryFingerprint,
  clearRecoveryFingerprint,
} from "src/infra/session-recovery";

export const SessionRecoveryGuard = () => {
  const isActive = useAtomValue(sessionRecoveryActiveAtom);
  const hasUnsavedChanges = useAtomValue(hasUnsavedChangesDerivedAtom);
  const modelVersion = useAtomValue(stagingModelDerivedAtom).version;
  const projectFileInfo = useAtomValue(projectFileInfoAtom);
  const projectName = projectFileInfo?.name ?? null;
  const lastSavedAt = projectFileInfo?.lastSavedAt;

  useEffect(() => {
    if (!isActive) return;

    if (hasUnsavedChanges) {
      writeRecoveryFingerprint({
        poolId: getAppId(),
        projectName,
        timestampLastModelChange: Date.now(),
        timestampLastSave: lastSavedAt,
      });
    } else {
      clearRecoveryFingerprint(getAppId());
    }
  }, [isActive, hasUnsavedChanges, modelVersion, projectName, lastSavedAt]);

  useEffect(() => {
    if (!isActive) return;

    const handlePageHide = () => clearRecoveryFingerprint(getAppId());
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [isActive]);

  return null;
};
