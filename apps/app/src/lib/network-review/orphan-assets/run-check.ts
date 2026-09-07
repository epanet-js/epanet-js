import * as Comlink from "comlink";

import { AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { OrphanAssets, buildOrphanAssets, encodeData } from "./data";
import {
  ActiveAssetIndex,
  ActiveTopology,
} from "src/hydraulic-model/utilities/active-only-queries";
import { topologyTransferables } from "src/hydraulic-model/topology/topology-transferable";
import { assetIndexTransferables } from "src/hydraulic-model/asset-index-transferable";
import { findOrphanAssets } from "./find-orphan-assets";
import { getOrphanAssetsWorker } from "./get-worker";
import { BufferType } from "@epanet-js/buffers";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";

export const runCheck = async (
  hydraulicModel: HydraulicModel,
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
  runInWorker: boolean = true,
): Promise<AssetId[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const encodedOrphanAssets = runInWorker
    ? await runWithWorker(hydraulicModel, bufferType, signal)
    : findOrphanAssets(
        new ActiveTopology(hydraulicModel.topology, hydraulicModel.assets),
        new ActiveAssetIndex(hydraulicModel.assetIndex, hydraulicModel.assets),
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

  const data = encodeData(model, bufferType);

  if (!canUseWorker()) {
    const { workerAPI: fallbackWorkerAPI } = await import("./worker-api");
    return fallbackWorkerAPI.findOrphanAssets(data);
  }

  const transferData = Comlink.transfer(data, [
    ...topologyTransferables(data.topologyBuffers),
    ...assetIndexTransferables(data.assetIndexBuffers),
  ]);

  const workerAPI = getOrphanAssetsWorker();
  try {
    const result = await workerAPI.findOrphanAssets(transferData);
    if (signal?.aborted) {
      throw new DOMException("Operation cancelled", "AbortError");
    }
    return result;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw enrichWorkerError("orphan-assets", e);
  }
};
