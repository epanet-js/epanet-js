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
): Promise<OrphanAsset[]> => {
  const { idsLookup, ...inputData } = encodeHydraulicModel(
    hydraulicModel,
    bufferType,
  );

  const useWorker = canUseWorker();

  const encodedOrphanAssets = useWorker
    ? await runWithWorker(inputData)
    : findOrphanAssets(inputData);

  return decodeOrphanAssets(hydraulicModel, idsLookup, encodedOrphanAssets);
};

const runWithWorker = async (data: RunData): Promise<EncodedOrphanAssets> => {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<OrphanAssetsWorkerAPI>(worker);

  try {
    return await workerAPI.findOrphanAssets(data);
  } finally {
    worker.terminate();
  }
};
