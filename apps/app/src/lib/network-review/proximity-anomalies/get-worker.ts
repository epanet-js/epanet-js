import * as Comlink from "comlink";
import type { ProximityCheckWorkerAPI } from "./worker";

let cached: Comlink.Remote<ProximityCheckWorkerAPI> | null = null;

export const createProximityAnomaliesWorker = (): {
  worker: Worker;
  api: Comlink.Remote<ProximityCheckWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "ProximityAnomaliesWorker",
  });
  return { worker, api: Comlink.wrap<ProximityCheckWorkerAPI>(worker) };
};

export const getProximityAnomaliesWorker =
  (): Comlink.Remote<ProximityCheckWorkerAPI> => {
    if (!cached) cached = createProximityAnomaliesWorker().api;
    return cached;
  };

export const resetProximityAnomaliesWorkerForTest = (): void => {
  cached = null;
};
