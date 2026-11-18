import * as Comlink from "comlink";
import type { TopologyChecksWorkerAPI } from "./worker-api";

let cached: Comlink.Remote<TopologyChecksWorkerAPI> | null = null;

const createTopologyChecksWorker = (): {
  worker: Worker;
  api: Comlink.Remote<TopologyChecksWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "TopologyChecksWorker",
  });
  return { worker, api: Comlink.wrap<TopologyChecksWorkerAPI>(worker) };
};

export const getTopologyChecksWorker =
  (): Comlink.Remote<TopologyChecksWorkerAPI> => {
    if (!cached) cached = createTopologyChecksWorker().api;
    return cached;
  };

export const resetTopologyChecksWorkerForTest = (): void => {
  cached = null;
};
