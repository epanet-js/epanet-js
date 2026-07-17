import * as Comlink from "comlink";
import type { DbWorkerApi } from "./worker-api";
import type { ShadowErrorReporter } from "./types";
import { isPerfLoggingEnabled } from "./perf-log";

let cached: Comlink.Remote<DbWorkerApi> | null = null;

export const getWorker = (): Comlink.Remote<DbWorkerApi> => {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("Db worker requires a browser environment");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "DBWorker",
  });
  const remote = Comlink.wrap<DbWorkerApi>(worker);
  if (isPerfLoggingEnabled()) {
    void remote.setPerfLogging(true);
  }
  cached = remote;
  return cached;
};

export const registerShadowErrorReporter = async (
  reporter: ShadowErrorReporter,
): Promise<void> => {
  await getWorker().setShadowErrorReporter(Comlink.proxy(reporter));
};

export const setWorkerForTest = (worker: DbWorkerApi): void => {
  cached = worker as unknown as Comlink.Remote<DbWorkerApi>;
};

export const resetWorkerForTest = (): void => {
  cached = null;
};
