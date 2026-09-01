import * as Comlink from "comlink";
import type { TraceWorkerAPI } from "./worker-api";

let cached: Comlink.Remote<TraceWorkerAPI> | null = null;

export const createTraceWorker = (): {
  worker: Worker;
  api: Comlink.Remote<TraceWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "TraceToolWorker",
  });
  return { worker, api: Comlink.wrap<TraceWorkerAPI>(worker) };
};

export const getTraceWorker = (): Comlink.Remote<TraceWorkerAPI> => {
  if (!cached) cached = createTraceWorker().api;
  return cached;
};

export const resetTraceWorkerForTest = (): void => {
  cached = null;
};
