import { getWorker, type SessionHistoryDiagnostics } from "@epanet-js/ejsdb";
import { captureWarning } from "src/infra/error-tracking";

export const fetchSessionHistory = async (
  limit = 200,
): Promise<SessionHistoryDiagnostics> => {
  const worker = getWorker();
  return worker.sessionHistoryDiagnostics(limit);
};

// Best-effort: the history is a debug side channel, so a failed restore must never
// interfere with recovering the project itself.
export const restoreSessionHistory = async (
  poolId: string,
): Promise<boolean> => {
  try {
    return await getWorker().restoreSessionFromPool(poolId);
  } catch {
    return false;
  }
};

// Session history never throws at its own call site: it is a flagged side channel that must
// not cost the caller its project write. This is the only path that makes a failure visible,
// so every command that opens or replaces the project db calls it.
export const reportSessionHistoryFailure = async (): Promise<void> => {
  try {
    const failure = await getWorker().sessionHistoryFailure();
    if (!failure) return;
    captureWarning(
      `Session history disabled (${failure.stage})`,
      new Error(`${failure.name}: ${failure.message}`),
    );
  } catch {
    // reporting must never break the load it is reporting on
  }
};
