import {
  getWorker,
  cleanupStaleDbPools,
  registerShadowErrorReporter,
  type ShadowErrorReport,
} from "@epanet-js/ejsdb";
import { getAppId, resetAppId } from "src/infra/app-instance";
import { isOPFSAvailable } from "src/infra/storage";
import { readRecoveryFingerprints } from "src/infra/session-recovery";
import { holdSessionLock, isSessionAlive } from "src/infra/session-lock";
import {
  captureError,
  captureWarning,
  captureInfo,
} from "src/infra/error-tracking";

export type DbStorageMode = "memory" | "shadow" | "sahpool";

export const configureDbStorage = async (
  isWriteDbToOpfsOn: boolean,
  isReadDbFromOpfsOn: boolean,
  sessionRecoveryEnabled: boolean,
): Promise<DbStorageMode> => {
  if (!isWriteDbToOpfsOn) return "memory";

  const opfsAvailable = await isOPFSAvailable();
  const requested = isReadDbFromOpfsOn ? "sahpool" : "shadow";
  const mode = opfsAvailable ? requested : "memory";

  const recoverablePoolIds = sessionRecoveryEnabled
    ? readRecoveryFingerprints().map((fingerprint) => fingerprint.poolId)
    : [];

  let appId = getAppId();

  if (recoverablePoolIds.includes(appId)) {
    appId = resetAppId();
  }

  // A duplicated/restored tab copies sessionStorage and boots with a live
  // tab's appId; installing on that tab's pool directory can steal its access
  // handles mid-swap. Rotate before ever touching the pool.
  if (mode !== "memory" && (await isSessionAlive(appId))) {
    appId = resetAppId();
  }

  let effective = await getWorker().configure({ mode, sahpoolId: appId });

  if (mode !== "memory" && effective !== mode) {
    appId = resetAppId();
    effective = await getWorker().configure({ mode, sahpoolId: appId });
  }

  if (effective !== "memory") {
    await holdSessionLock(appId);
    void cleanupStaleDbPools(appId, recoverablePoolIds, isSessionAlive);
  }

  if (effective === "shadow") {
    await registerShadowErrorReporter(shadowErrorToSentry(appId));
  }

  if (mode !== "memory" && effective !== mode) {
    captureWarning("OPFS db storage requested but fell back to in-memory db");
  }

  captureInfo("Effective DB storage mode", { mode, effective });

  return effective;
};

const shadowErrorToSentry =
  (appId: string) =>
  (report: ShadowErrorReport): void => {
    const error = new Error(
      `[shadow-opfs] ${report.command}: ${report.errorMessage}`,
    );
    error.name = report.errorName;
    error.stack = report.errorDetails;
    captureError(error, {
      shadowOpfs: {
        command: report.command,
        phase: report.phase,
        appId,
        isFirstFailure: report.isFirstFailure,
        shadowDisabled: report.shadowDisabled,
      },
    });
  };
