import * as Comlink from "comlink";
import type { DbWorkerApi } from "./db-worker";

let cached: Comlink.Remote<DbWorkerApi> | null = null;

export const getDbWorker = (): Comlink.Remote<DbWorkerApi> => {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    throw new Error("Db worker requires a browser environment");
  }
  const worker = new Worker(new URL("./db-worker.ts", import.meta.url), {
    type: "module",
  });
  cached = Comlink.wrap<DbWorkerApi>(worker);
  return cached;
};
