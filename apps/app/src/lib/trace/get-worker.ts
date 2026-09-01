import * as Comlink from "comlink";
import type { TraceWorkerAPI } from "./worker-api";

let cached: Comlink.Remote<TraceWorkerAPI> | null = null;

export const getTraceWorker = (): Comlink.Remote<TraceWorkerAPI> => {
  if (cached) return cached;

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "TraceToolWorker",
  });
  cached = Comlink.wrap<TraceWorkerAPI>(worker);
  return cached;
};

export const resetTraceWorkerForTest = (): void => {
  cached = null;
};
