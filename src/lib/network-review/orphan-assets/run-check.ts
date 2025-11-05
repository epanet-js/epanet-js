import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import {
  OrphanAsset,
  OrphanAssets,
  buildOrphanAssets,
  encodeData,
} from "./data";
import { findOrphanAssets } from "./find-orphan-assets";
import type { OrphanAssetsWorkerAPI } from "./worker-api";
import { BufferType } from "src/lib/buffers";
import { canUseWorker } from "src/infra/worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
  runInWorker: boolean = true,
): Promise<OrphanAsset[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const encodedOrphanAssets = runInWorker
    ? await runWithWorker(hydraulicModel, bufferType, signal)
    : findOrphanAssets(hydraulicModel.topology, hydraulicModel.assetIndex);

  return buildOrphanAssets(hydraulicModel, encodedOrphanAssets);
};

const runWithWorker = async (
  model: HydraulicModel,
  bufferType: BufferType,
  signal?: AbortSignal,
): Promise<OrphanAssets> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const data = encodeData(model, bufferType);

  if (!canUseWorker()) {
    const { workerAPI: fallbackWorkerAPI } = await import("./worker-api");
    return fallbackWorkerAPI.findOrphanAssets(data);
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<OrphanAssetsWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    const data = encodeData(model, bufferType);
    return await workerAPI.findOrphanAssets(data);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
