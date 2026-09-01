import { getWorker } from "@epanet-js/ejsdb";
import { resetAppId } from "src/infra/app-instance";
import { holdSessionLock } from "src/infra/session-lock";
import { addToErrorLog } from "src/infra/error-tracking";
import type { DbStorageMode } from "src/state/session-recovery";
import { importProject, type ImportProjectInput } from "./import-project";

export type RebuildPhase = "storage" | "writing" | "finalizing";

export type RebuildOptions = {
  skipOpfs?: boolean;
  onPhase?: (phase: RebuildPhase) => void;
};

type RebuildInput = ImportProjectInput &
  Required<Pick<ImportProjectInput, "zones">>;

export const rebuildDbFromMemory = async (
  input: RebuildInput,
  { skipOpfs = false, onPhase }: RebuildOptions = {},
): Promise<DbStorageMode> => {
  onPhase?.("storage");

  const appId = resetAppId();
  const mode = skipOpfs
    ? await getWorker().configure({ mode: "memory", sahpoolId: appId })
    : await getWorker().reinstallSahpool(appId);
  const storageMode: DbStorageMode = mode === "sahpool" ? "opfs" : "memory";

  if (storageMode === "opfs") {
    await holdSessionLock(appId);
    addToErrorLog({
      category: "db",
      level: "info",
      message: "DB storage reinstalled on OPFS",
      data: { appId },
    });
  } else if (skipOpfs) {
    addToErrorLog({
      category: "db",
      level: "warning",
      message: "OPFS given up on for this session; rebuilding in memory",
    });
  } else {
    const failure = await getWorker().sahpoolFailure();
    addToErrorLog({
      category: "db",
      level: "warning",
      message: "DB storage reinstall failed; rebuilding in memory",
      data: failure ?? {},
    });
  }

  onPhase?.("writing");
  await importProject({ ...input, newDb: true });

  onPhase?.("finalizing");
  return storageMode;
};
