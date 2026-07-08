import { getWorker, cleanupStaleDbPools } from "@epanet-js/ejsdb";
import { getAppId, resetAppId } from "src/infra/app-instance";
import { isOPFSAvailable } from "src/infra/storage";
import { captureWarning, captureInfo } from "src/infra/error-tracking";

export const configureDbStorage = async (
  featureFlagEnabled: boolean,
): Promise<"memory" | "sahpool"> => {
  if (!featureFlagEnabled) return "memory";

  const useSahpool = await isOPFSAvailable();
  const mode = useSahpool ? "sahpool" : "memory";

  let appId = getAppId();
  let effective = await getWorker().configure({ mode, sahpoolId: appId });

  if (useSahpool && effective !== "sahpool") {
    appId = resetAppId();
    effective = await getWorker().configure({ mode, sahpoolId: appId });
  }

  if (effective === "sahpool") {
    void cleanupStaleDbPools(appId);
  }

  if (mode === "sahpool" && effective !== "sahpool") {
    captureWarning("OPFS sahpool requested but fell back to in-memory db");
  }

  captureInfo("Effective DB storage mode", { mode, effective });

  return effective;
};
