export { getWorker, setWorkerForTest, resetWorkerForTest } from "./get-worker";
// Note: `api` is intentionally not re-exported here. It lives in worker-api.ts,
// whose top-level SQLite-WASM init must not run on the server during SSR. Import
// it via the "@epanet-js/ejsdb/worker-api" subpath (worker + tests only).
export type { DbWorkerApi } from "./worker-api";
export { APP_VERSION } from "./migrations";
export { timed, timedWith } from "./perf-log";
export type {
  OpenDbResult,
  ApplyMomentPayload,
  CustomAttributesDataSave,
  CustomAttributeValueUpdate,
  AssetCustomAttributeUpdates,
  CustomerPointDemandUpdate,
  JunctionDemandUpdate,
} from "./types";
export { emptyAssetCustomAttributeUpdates } from "./types";
export * from "./schema";
