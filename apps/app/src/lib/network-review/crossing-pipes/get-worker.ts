import * as Comlink from "comlink";
import type { CrossingPipesWorkerAPI } from "./worker";

let cached: Comlink.Remote<CrossingPipesWorkerAPI> | null = null;

export const createCrossingPipesWorker = (): {
  worker: Worker;
  api: Comlink.Remote<CrossingPipesWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "CrossingPipesWorker",
  });
  return { worker, api: Comlink.wrap<CrossingPipesWorkerAPI>(worker) };
};

export const getCrossingPipesWorker =
  (): Comlink.Remote<CrossingPipesWorkerAPI> => {
    if (!cached) cached = createCrossingPipesWorker().api;
    return cached;
  };

export const resetCrossingPipesWorkerForTest = (): void => {
  cached = null;
};
