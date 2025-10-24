import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  SubNetwork,
  RunData,
  EncodedSubNetworks,
  encodeHydraulicModelForSubnetworks,
  decodeSubNetworks,
} from "./data";
import { findSubNetworksFromBuffers } from "./find-subnetworks";
import type { ConnectivityTraceWorkerAPI } from "./worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  bufferType: ArrayBufferType = "array",
  signal?: AbortSignal,
): Promise<SubNetwork[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const { idsLookup, ...inputData } = encodeHydraulicModelForSubnetworks(
    hydraulicModel,
    bufferType,
  );

  const useWorker = canUseWorker();

  const encodedSubNetworks = useWorker
    ? await runWithWorker(inputData, signal)
    : findSubNetworksFromBuffers(inputData);

  const result = decodeSubNetworks(idsLookup, encodedSubNetworks);

  return result;
};

const runWithWorker = async (
  data: RunData,
  signal?: AbortSignal,
): Promise<EncodedSubNetworks> => {
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
    return await workerAPI.findSubNetworksFromBuffers(data);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
