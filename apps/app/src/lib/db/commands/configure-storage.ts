import { getWorker, cleanupStaleDbPools } from "@epanet-js/ejsdb";
import { getAppId, resetAppId } from "src/infra/app-instance";
import { isOPFSAvailable } from "src/infra/storage";
import { readRecoveryFingerprints } from "src/infra/session-recovery";
import { holdSessionLock, isSessionAlive } from "src/infra/session-lock";
import { captureWarning, captureInfo } from "src/infra/error-tracking";

export const configureDbStorage = async (
  featureFlagEnabled: boolean,
  sessionRecoveryEnabled: boolean,
): Promise<"memory" | "sahpool"> => {
  if (!featureFlagEnabled) return "memory";

  const useSahpool = await isOPFSAvailable();
  const mode = useSahpool ? "sahpool" : "memory";

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
  if (useSahpool && (await isSessionAlive(appId))) {
    appId = resetAppId();
  }

  let effective = await getWorker().configure({ mode, sahpoolId: appId });

  if (useSahpool && effective !== "sahpool") {
    appId = resetAppId();
    effective = await getWorker().configure({ mode, sahpoolId: appId });
  }

  if (effective === "sahpool") {
    await holdSessionLock(appId);
    void cleanupStaleDbPools(appId, recoverablePoolIds, isSessionAlive);
  }

  if (mode === "sahpool" && effective !== "sahpool") {
    captureWarning("OPFS sahpool requested but fell back to in-memory db");
  }

  captureInfo("Effective DB storage mode", { mode, effective });

  return effective;
};
