import { getWorker, cleanupStaleDbPools } from "@epanet-js/ejsdb";
import { getAppId, resetAppId } from "src/infra/app-instance";
import { isOPFSAvailable } from "src/infra/storage";
import { readRecoveryFingerprints } from "src/infra/session-recovery";
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

  let effective = await getWorker().configure({ mode, sahpoolId: appId });

  if (useSahpool && effective !== "sahpool") {
    appId = resetAppId();
    effective = await getWorker().configure({ mode, sahpoolId: appId });
  }

  if (effective === "sahpool") {
    void cleanupStaleDbPools(appId, recoverablePoolIds);
  }

  if (mode === "sahpool" && effective !== "sahpool") {
    captureWarning("OPFS sahpool requested but fell back to in-memory db");
  }

  captureInfo("Effective DB storage mode", { mode, effective });

  return effective;
};
