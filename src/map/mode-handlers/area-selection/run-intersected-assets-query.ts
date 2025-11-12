import * as Comlink from "comlink";
import { Position } from "src/types";
import { AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import {
  AssetsGeoIndex,
  AssetsGeoBuffers,
} from "src/hydraulic-model/assets-geo";
import { AssetIndexBuffers } from "src/hydraulic-model/asset-index";
import { queryIntersectedAssets } from "src/hydraulic-model/spatial-queries";
import { canUseWorker } from "src/infra/worker";
import type { SpatialQueryWorkerAPI } from "./worker-api";
import {
  EncodedContainedAssets,
  decodeContainedAssets,
  encodeHydraulicModel,
} from "./data";
import { BufferType } from "src/lib/buffers";

export const runIntersectedAssetsQuery = async (
  hydraulicModel: HydraulicModel,
  points: Position[],
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
  runInWorker: boolean = true,
): Promise<AssetId[]> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  if (runInWorker) {
    const { assetsGeoBuffers, assetIndexBuffers } = encodeHydraulicModel(
      hydraulicModel,
      bufferType,
    );

    const encodedResult = await runWithWorker(
      assetIndexBuffers,
      assetsGeoBuffers,
      points,
      signal,
    );

    return decodeContainedAssets(encodedResult);
  } else {
    const assetsGeo = new AssetsGeoIndex(
      hydraulicModel.assets,
      hydraulicModel.assetIndex,
    );
    return queryIntersectedAssets(assetsGeo, points);
  }
};

const runWithWorker = async (
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  points: Position[],
  signal?: AbortSignal,
): Promise<EncodedContainedAssets> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  if (!canUseWorker()) {
    const { workerAPI: fallbackWorkerAPI } = await import("./worker-api");
    return fallbackWorkerAPI.queryIntersectedAssets(
      assetIndexBuffers,
      assetsGeoBuffers,
      points,
    );
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });

  const workerAPI = Comlink.wrap<SpatialQueryWorkerAPI>(worker);

  const abortHandler = () => worker.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    return await workerAPI.queryIntersectedAssets(
      assetIndexBuffers,
      assetsGeoBuffers,
      points,
    );
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
