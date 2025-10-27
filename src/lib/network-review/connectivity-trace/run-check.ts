import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  SubNetwork,
  RunData,
  EncodedSubNetworks,
  decodeSubNetworks,
} from "./data";
import { findSubNetworks } from "./find-subnetworks";
import type { ConnectivityTraceWorkerAPI } from "./worker";
import { HydraulicModelEncoder } from "../shared";

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
  const { nodes, links, nodeIdsLookup, linkIdsLookup } = encoder.buildBuffers();
  const inputData: RunData = {
    linksConnections: links.connections,
    nodesConnections: nodes.connections,
    nodeTypes: nodes.types,
    linkTypes: links.types,
    linkBounds: links.bounds,
  };

  const useWorker = canUseWorker();

  const encodedSubNetworks = useWorker
    ? await runWithWorker(inputData, signal)
    : findSubNetworks(inputData);

  const result = decodeSubNetworks(
    nodeIdsLookup,
    linkIdsLookup,
    encodedSubNetworks,
  );

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
    return await workerAPI.findSubNetworks(data);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
