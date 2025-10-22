import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { SubNetwork } from "./data";
import { findSubNetworks } from "./find-subnetworks";
import type { ConnectivityTraceWorkerAPI } from "./worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
): Promise<SubNetwork[]> => {
  const useWorker = false;

  if (useWorker) {
    return await runWithWorker(hydraulicModel);
  }

  return findSubNetworks(hydraulicModel);
};

const runWithWorker = async (
  hydraulicModel: HydraulicModel,
): Promise<SubNetwork[]> => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<ConnectivityTraceWorkerAPI>(worker);

  try {
    return await workerAPI.findSubNetworks(hydraulicModel);
  } finally {
    worker.terminate();
  }
};
