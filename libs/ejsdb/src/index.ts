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
export {
  timed,
  timedWith,
  timedSync,
  timedWithSync,
  isPerfLoggingEnabled,
} from "./perf-log";
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
  emptyApplyMomentPayload,
  isEmptyApplyMomentPayload,
} from "./types";
export * from "./schema";
export { buildChangeSetPayload } from "./change-set/to-payload";
export {
  column,
  patchFrom,
  rowFrom,
  toDbBool,
  toNullable,
  type ColumnMap,
  type ColumnWriter,
} from "./change-set/column-map";
export {
  junctionMap,
  reservoirMap,
  tankMap,
  pipeMap,
  pumpMap,
  valveMap,
  customerPointMap,
  curveMap,
  patternMap,
} from "./change-set/columns";
