import { getWorker, cleanupStaleDbPools } from "@epanet-js/ejsdb";
import { getAppId, resetAppId } from "src/infra/app-instance";
import { isOPFSAvailable, getAvailableStorageBytes } from "src/infra/storage";
import { readRecoveryFingerprints } from "src/infra/session-recovery";
import { holdSessionLock, isSessionAlive } from "src/infra/session-lock";
import { captureWarning, captureInfo } from "src/infra/error-tracking";

export type DbStorageMode = "memory" | "sahpool";

const OPFS_MIN_AVAILABLE_BYTES = 512 * 1024 * 1024;

export const configureDbStorage = async (
  sessionRecoveryEnabled: boolean,
): Promise<DbStorageMode> => {
  const opfsAvailable = await isOPFSAvailable();
  if (!opfsAvailable) {
    reportFallback("opfs-not-available");
    return await getWorker().configure({
      mode: "memory",
      sahpoolId: getAppId(),
    });
  }

  const availableBytes = await getAvailableStorageBytes();
  const quotaExceeded = availableBytes < OPFS_MIN_AVAILABLE_BYTES;
  if (quotaExceeded) {
    reportFallback("opfs-quota-exceeded");
    return await getWorker().configure({
      mode: "memory",
      sahpoolId: getAppId(),
    });
  }

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
  if (await isSessionAlive(appId)) {
    appId = resetAppId();
  }

  const mode = "sahpool";
  let effective = await getWorker().configure({ mode, sahpoolId: appId });

  if (effective !== mode) {
    appId = resetAppId();
    effective = await getWorker().configure({ mode, sahpoolId: appId });
  }

  if (effective !== "memory") {
    await holdSessionLock(appId);
    void cleanupStaleDbPools(appId, recoverablePoolIds, isSessionAlive).catch(
      (error) =>
        captureWarning("Stale DB pool cleanup failed (bootstrap)", error),
    );
  }

  captureInfo("Effective DB storage mode", { mode, effective });

  if (effective !== mode) {
    reportFallback("db-worker-fallback");
  }

  return effective;
};

const reportFallback = (reason: string) =>
  captureWarning(
    `OPFS db storage requested but fell back to in-memory db: ${reason}`,
  );
