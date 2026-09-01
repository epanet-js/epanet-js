import * as Comlink from "comlink";
import type { OrphanAssetsWorkerAPI } from "./worker-api";

let cached: Comlink.Remote<OrphanAssetsWorkerAPI> | null = null;

export const createOrphanAssetsWorker = (): {
  worker: Worker;
  api: Comlink.Remote<OrphanAssetsWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "OrphanAssetsWorker",
  });
  return { worker, api: Comlink.wrap<OrphanAssetsWorkerAPI>(worker) };
};

export const getOrphanAssetsWorker =
  (): Comlink.Remote<OrphanAssetsWorkerAPI> => {
    if (!cached) cached = createOrphanAssetsWorker().api;
    return cached;
  };

export const resetOrphanAssetsWorkerForTest = (): void => {
  cached = null;
};
