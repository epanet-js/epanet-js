import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import {
  ArrayBufferType,
  canUseWorker,
  enrichWorkerError,
} from "src/infra/worker";
import { EncodedSubNetwork, SubNetwork, decodeSubNetworks } from "./data";
import { findSubNetworks } from "./find-subnetworks";
import {
  createConnectivityTraceWorker,
  getConnectivityTraceWorker,
} from "./get-worker";
import { areLongLivedWorkersEnabled } from "src/infra/long-lived-workers";
import {
  HydraulicModelBuffers,
  HydraulicModelEncoder,
  hydraulicModelTransferables,
} from "../hydraulic-model-buffers";

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

  const transferData = Comlink.transfer(
    data,
    hydraulicModelTransferables(data),
  );

  if (areLongLivedWorkersEnabled()) {
    const workerAPI = getConnectivityTraceWorker();
    try {
      const result = await workerAPI.findSubNetworks(transferData);
      if (signal?.aborted) {
        throw new DOMException("Operation cancelled", "AbortError");
      }
      return result;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw enrichWorkerError("connectivity-trace", e);
    }
  }

  const { worker, api: workerAPI } = createConnectivityTraceWorker();

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findSubNetworks(transferData);
  } catch (e) {
    throw enrichWorkerError("connectivity-trace", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
