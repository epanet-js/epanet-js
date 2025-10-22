import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  EncodedOrphanAssets,
  encodeHydraulicModel,
  decodeOrphanAssets,
  OrphanAsset,
  RunData,
} from "./data";
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

  const { idsLookup, ...inputData } = encodeHydraulicModel(
    hydraulicModel,
    bufferType,
  );

  const useWorker = canUseWorker();

  const encodedOrphanAssets = useWorker
    ? await runWithWorker(inputData, signal)
    : findOrphanAssets(inputData);

  return decodeOrphanAssets(hydraulicModel, idsLookup, encodedOrphanAssets);
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
