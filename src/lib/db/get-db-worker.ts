import * as Comlink from "comlink";
import type { DbWorkerApi } from "./db-worker-api";
import { isPerfLoggingEnabled } from "./perf-log";

let cached: Comlink.Remote<DbWorkerApi> | null = null;

export const getDbWorker = (): Comlink.Remote<DbWorkerApi> => {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("Db worker requires a browser environment");
  }
  const worker = new Worker(new URL("./db-worker.ts", import.meta.url), {
    type: "module",
  });
  const remote = Comlink.wrap<DbWorkerApi>(worker);
  if (isPerfLoggingEnabled()) {
    void remote.setPerfLogging(true);
  }
  cached = remote;
  return cached;
};

export const setDbWorkerForTest = (worker: DbWorkerApi): void => {
  cached = worker as unknown as Comlink.Remote<DbWorkerApi>;
};

export const resetDbWorkerForTest = (): void => {
  cached = null;
};
