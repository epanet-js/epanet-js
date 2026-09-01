import * as Comlink from "comlink";
import type { ConnectivityTraceWorkerAPI } from "./worker";

let cached: Comlink.Remote<ConnectivityTraceWorkerAPI> | null = null;

export const createConnectivityTraceWorker = (): {
  worker: Worker;
  api: Comlink.Remote<ConnectivityTraceWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "ConnectivityTraceWorker",
  });
  return { worker, api: Comlink.wrap<ConnectivityTraceWorkerAPI>(worker) };
};

export const getConnectivityTraceWorker =
  (): Comlink.Remote<ConnectivityTraceWorkerAPI> => {
    if (!cached) cached = createConnectivityTraceWorker().api;
    return cached;
  };

export const resetConnectivityTraceWorkerForTest = (): void => {
  cached = null;
};
