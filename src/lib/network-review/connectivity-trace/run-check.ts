import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import { EncodedSubNetwork, SubNetwork, decodeSubNetworks } from "./data";
import { findSubNetworks } from "./find-subnetworks";
import type { ConnectivityTraceWorkerAPI } from "./worker";
import { HydraulicModelBuffers, HydraulicModelEncoder } from "../shared";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  bufferType: ArrayBufferType = "array",
  signal?: AbortSignal,
): Promise<SubNetwork[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const encoder = new HydraulicModelEncoder(hydraulicModel, {
    nodes: new Set(["types", "connections"]),
    links: new Set(["types", "connections", "bounds"]),
    bufferType,
  });
  const { nodeIdsLookup, linkIdsLookup, ...data } = encoder.buildBuffers();

  const useWorker = canUseWorker();

  const encodedSubNetworks = useWorker
    ? await runWithWorker(data, signal)
    : findSubNetworks(data);

  const result = decodeSubNetworks(
    nodeIdsLookup,
    linkIdsLookup,
    encodedSubNetworks,
  );

  return result;
};

const runWithWorker = async (
  data: HydraulicModelBuffers,
  signal?: AbortSignal,
): Promise<EncodedSubNetwork[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<ConnectivityTraceWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findSubNetworks(data);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
