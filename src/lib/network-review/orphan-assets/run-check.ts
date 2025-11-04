import * as Comlink from "comlink";

import { HydraulicModel } from "src/hydraulic-model";
import { ArrayBufferType, canUseWorker } from "src/infra/worker";
import {
  OrphanAsset,
  OrphanAssets,
  buildOrphanAssets,
  encodeData,
} from "./data";
import { findOrphanAssets } from "./find-orphan-assets";
import type { OrphanAssetsWorkerAPI } from "./worker";
import { AssetTypeQueries } from "src/hydraulic-model/asset-type-queries";
import { BufferType } from "src/lib/buffers";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  bufferType: ArrayBufferType = "array",
  signal?: AbortSignal,
): Promise<OrphanAsset[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const useWorker = canUseWorker();

  const encodedOrphanAssets = useWorker
    ? await runWithWorker(hydraulicModel, bufferType, signal)
    : findOrphanAssets(
        hydraulicModel.topology,
        hydraulicModel.assetIndex,
        new AssetTypeQueries(hydraulicModel.assets),
      );

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
