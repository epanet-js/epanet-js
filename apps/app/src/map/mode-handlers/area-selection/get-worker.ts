import * as Comlink from "comlink";
import type { SpatialQueryWorkerAPI } from "./worker-api";

let cached: Comlink.Remote<SpatialQueryWorkerAPI> | null = null;

export const createSpatialQueryWorker = (): {
  worker: Worker;
  api: Comlink.Remote<SpatialQueryWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "SpatialQueryWorker",
  });
  return { worker, api: Comlink.wrap<SpatialQueryWorkerAPI>(worker) };
};

export const getSpatialQueryWorker =
  (): Comlink.Remote<SpatialQueryWorkerAPI> => {
    if (!cached) cached = createSpatialQueryWorker().api;
    return cached;
  };

export const resetSpatialQueryWorkerForTest = (): void => {
  cached = null;
};
