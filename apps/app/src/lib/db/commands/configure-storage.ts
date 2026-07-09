import { getWorker, cleanupStaleDbPools } from "@epanet-js/ejsdb";
import { getAppId, resetAppId } from "src/infra/app-instance";
import { isOPFSAvailable } from "src/infra/storage";
import { readRecoveryFingerprint } from "src/infra/session-recovery";
import { captureWarning, captureInfo } from "src/infra/error-tracking";

export const configureDbStorage = async (
  featureFlagEnabled: boolean,
  sessionRecoveryEnabled: boolean,
): Promise<"memory" | "sahpool"> => {
  if (!featureFlagEnabled) return "memory";

  const useSahpool = await isOPFSAvailable();
  const mode = useSahpool ? "sahpool" : "memory";

  const recoverablePoolId = sessionRecoveryEnabled
    ? (readRecoveryFingerprint()?.poolId ?? null)
    : null;

  let appId = getAppId();

  if (recoverablePoolId && recoverablePoolId === appId) {
    appId = resetAppId();
  }

  let effective = await getWorker().configure({ mode, sahpoolId: appId });

  if (useSahpool && effective !== "sahpool") {
    appId = resetAppId();
    effective = await getWorker().configure({ mode, sahpoolId: appId });
  }

  if (effective === "sahpool") {
    const protectedIds = recoverablePoolId ? [recoverablePoolId] : [];
    void cleanupStaleDbPools(appId, protectedIds);
  }

  if (mode === "sahpool" && effective !== "sahpool") {
    captureWarning("OPFS sahpool requested but fell back to in-memory db");
  }

  captureInfo("Effective DB storage mode", { mode, effective });

  return effective;
};
