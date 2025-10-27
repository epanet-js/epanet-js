import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  EncodedOrphanAssets,
  decodeOrphanAssets,
  OrphanAsset,
  RunData,
} from "./data";
import { HydraulicModelEncoder } from "../shared";
import { findOrphanAssets } from "./find-orphan-assets";
import type { OrphanAssetsWorkerAPI } from "./worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  bufferType: ArrayBufferType = "array",
  signal?: AbortSignal,
): Promise<OrphanAsset[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const encoder = new HydraulicModelEncoder(hydraulicModel, {
    links: new Set(["connections", "types"]),
    nodes: new Set(["connections"]),
    bufferType,
  });
  const { links, nodes, linkIdsLookup, nodeIdsLookup } = encoder.buildBuffers();
  const inputData: RunData = {
    linksConnections: links.connections,
    linkTypes: links.types,
    nodeConnections: nodes.connections,
  };

  const useWorker = canUseWorker();

  const encodedOrphanAssets = useWorker
    ? await runWithWorker(inputData, signal)
    : findOrphanAssets(inputData);

  return decodeOrphanAssets(
    hydraulicModel,
    nodeIdsLookup,
    linkIdsLookup,
    encodedOrphanAssets,
  );
};

const runWithWorker = async (
  data: RunData,
  signal?: AbortSignal,
): Promise<EncodedOrphanAssets> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<OrphanAssetsWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.findOrphanAssets(data);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
