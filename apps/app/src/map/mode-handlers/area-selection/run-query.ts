import * as Comlink from "comlink";
import { Position } from "src/types";
import { AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import {
  AssetsGeoBuffers,
  AssetsGeoIndex,
  assetsGeoTransferables,
} from "src/hydraulic-model/assets-geo";
import {
  AssetIndexBuffers,
  assetIndexTransferables,
} from "src/hydraulic-model/asset-index-transferable";
import { customerPointsGeoTransferables } from "src/hydraulic-model/customer-points-geo";
import { queryContainedAssets } from "src/hydraulic-model/spatial-queries";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import type { SpatialQueryWorkerAPI } from "./worker-api";
import {
  EncodedAreaSelectionBuffers,
  EncodedAreaSelectionResult,
  EncodedContainedAssets,
  cloneEncodedAreaSelectionBuffers,
  decodeAreaSelectionResult,
  decodeContainedAssets,
  encodeHydraulicModel,
  getEncodedAreaSelectionBuffers,
} from "./data";
import { BufferType } from "src/lib/buffers";

export type AreaSelectionResult = {
  assetIds: AssetId[];
  customerPointIds: number[];
};

// ─── Deprecated path (FLAG_MULTI_CP_SELECTION off) ─────────────────────────
// Byte-identical to the pre-feature implementation: encodes the model each
// drag, spawns a worker, runs the asset-only query.

export const runQueryDeprecated = async (
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

    const encodedResult = await runAssetsWithWorker(
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
    return queryContainedAssets(assetsGeo, points);
  }
};

const runAssetsWithWorker = async (
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
    return fallbackWorkerAPI.queryContainedAssets(
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
    return await workerAPI.queryContainedAssets(
      Comlink.transfer(
        assetIndexBuffers,
        assetIndexTransferables(assetIndexBuffers),
      ),
      Comlink.transfer(
        assetsGeoBuffers,
        assetsGeoTransferables(assetsGeoBuffers),
      ),
      points,
    );
  } catch (e) {
    throw enrichWorkerError("spatial-query", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};

// ─── New path (FLAG_MULTI_CP_SELECTION on) ─────────────────────────────────
// Caches encoded asset and customer-point buffers across drags; clones
// before transfer so the cache survives Comlink's ownership move.

export const runQueryNew = async (
  hydraulicModel: HydraulicModel,
  points: Position[],
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
): Promise<AreaSelectionResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const cached = getEncodedAreaSelectionBuffers(hydraulicModel, bufferType);
  const encoded = cloneEncodedAreaSelectionBuffers(cached);

  const encodedResult = await runFeaturesWithWorker(encoded, points, signal);
  return decodeAreaSelectionResult(encodedResult);
};

const runFeaturesWithWorker = async (
  encoded: EncodedAreaSelectionBuffers,
  points: Position[],
  signal?: AbortSignal,
): Promise<EncodedAreaSelectionResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  if (!canUseWorker()) {
    const { workerAPI: fallbackWorkerAPI } = await import("./worker-api");
    return fallbackWorkerAPI.queryContainedFeatures(
      encoded.assetIndexBuffers,
      encoded.assetsGeoBuffers,
      encoded.customerPointsGeoBuffers,
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
    return await workerAPI.queryContainedFeatures(
      Comlink.transfer(
        encoded.assetIndexBuffers,
        assetIndexTransferables(encoded.assetIndexBuffers),
      ),
      Comlink.transfer(
        encoded.assetsGeoBuffers,
        assetsGeoTransferables(encoded.assetsGeoBuffers),
      ),
      Comlink.transfer(
        encoded.customerPointsGeoBuffers,
        customerPointsGeoTransferables(encoded.customerPointsGeoBuffers),
      ),
      points,
    );
  } catch (e) {
    throw enrichWorkerError("spatial-query", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
