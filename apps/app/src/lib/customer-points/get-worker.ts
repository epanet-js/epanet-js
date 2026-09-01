import * as Comlink from "comlink";
import type { AllocationWorkerAPI } from "./worker";

let cached: Comlink.Remote<AllocationWorkerAPI> | null = null;

export const createCustomerPointsWorker = (): {
  worker: Worker;
  api: Comlink.Remote<AllocationWorkerAPI>;
} => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "CustomerPointsWorker",
  });
  return { worker, api: Comlink.wrap<AllocationWorkerAPI>(worker) };
};

export const getCustomerPointsWorker =
  (): Comlink.Remote<AllocationWorkerAPI> => {
    if (!cached) cached = createCustomerPointsWorker().api;
    return cached;
  };

export const resetCustomerPointsWorkerForTest = (): void => {
  cached = null;
};
