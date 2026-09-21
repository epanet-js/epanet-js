import * as Comlink from "comlink";
import type { DbWorkerApi } from "./worker-api";
import { isPerfLoggingEnabled } from "./perf-log";

let cached: Comlink.Remote<DbWorkerApi> | null = null;

const defaultWorkerFactory = (): Worker =>
  new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "DBWorker",
  });

let workerFactory: () => Worker = defaultWorkerFactory;

export const registerWorkerFactory = (factory: () => Worker): void => {
  if (cached) {
    throw new Error("Db worker factory registered after the worker started");
  }
  workerFactory = factory;
};

export const getWorker = (): Comlink.Remote<DbWorkerApi> => {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("Db worker requires a browser environment");
  }

  const worker = workerFactory();
  const remote = Comlink.wrap<DbWorkerApi>(worker);
  if (isPerfLoggingEnabled()) {
    void remote.setPerfLogging(true);
  }
  cached = remote;
  return cached;
};

export const setWorkerForTest = (worker: DbWorkerApi): void => {
  cached = worker as unknown as Comlink.Remote<DbWorkerApi>;
};

export const resetWorkerForTest = (): void => {
  cached = null;
};
