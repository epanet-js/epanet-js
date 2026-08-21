export { getWorker, setWorkerForTest, resetWorkerForTest } from "./get-worker";
export { cleanupStaleDbPools, dbPoolExists } from "./sahpool-storage";
// Note: `api` is intentionally not re-exported here. It lives in worker-api.ts,
// whose top-level SQLite-WASM init must not run on the server during SSR. Import
// it via the "@epanet-js/ejsdb/worker-api" subpath (worker + tests only).
export type {
  DbWorkerApi,
  SahpoolFailure,
  DbStorageDiagnostics,
} from "./worker-api";
export { APP_VERSION } from "./migrations";
export { timed, timedWith } from "./perf-log";
export type {
  NewDbResult,
  OpenDbResult,
  ApplyMomentPayload,
  ImportProjectPayload,
  CustomAttributeValueUpdate,
  AssetCustomAttributeUpdates,
  CustomerPointDemandUpdate,
  JunctionDemandUpdate,
} from "./types";
export {
  emptyAssetCustomAttributeUpdates,
  isEmptyApplyMomentPayload,
} from "./types";
export {
  SESSION_VERSION,
  MAX_ENTRY_BYTES,
  MAX_TOTAL_BYTES,
  emptySessionHistoryDiagnostics,
} from "./session";
export type {
  HistoryCapture,
  SessionHistoryEntry,
  SessionHistoryDiagnostics,
  SessionHistoryFailure,
} from "./session";
export * from "./schema";
