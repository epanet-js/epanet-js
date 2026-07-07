import * as Comlink from "comlink";
import { Position } from "src/types";
import { AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import {
  AssetsGeoIndex,
  assetsGeoTransferables,
} from "src/hydraulic-model/assets-geo";
import { assetIndexTransferables } from "src/hydraulic-model/asset-index-transferable";
import {
  CustomerPointsGeoIndex,
  customerPointsGeoTransferables,
  queryContainedCustomerPoints,
} from "src/hydraulic-model/customer-points-geo";
import { queryContainedAssets } from "src/hydraulic-model/spatial-queries";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import type { SpatialQueryWorkerAPI } from "./worker-api";
import {
  EncodedAreaSelectionBuffers,
  EncodedAreaSelectionResult,
  cloneEncodedAreaSelectionBuffers,
  decodeAreaSelectionResult,
  getEncodedAreaSelectionBuffers,
} from "./data";
import { BufferType } from "src/lib/buffers";

export type AreaSelectionResult = {
  assetIds: AssetId[];
  customerPointIds: number[];
};

export const runQuery = async (
  hydraulicModel: HydraulicModel,
  points: Position[],
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
  includeCustomerPoints: boolean = true,
): Promise<AreaSelectionResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  if (!canUseWorker()) {
    return runQueryInProcess(hydraulicModel, points, includeCustomerPoints);
  }

  const cached = getEncodedAreaSelectionBuffers(
    hydraulicModel,
    bufferType,
    includeCustomerPoints,
  );
  const encoded = cloneEncodedAreaSelectionBuffers(cached);

  const encodedResult = await runQueryWithWorker(encoded, points, signal);
  return decodeAreaSelectionResult(encodedResult);
};

const runQueryInProcess = (
  hydraulicModel: HydraulicModel,
  points: Position[],
  includeCustomerPoints: boolean,
): AreaSelectionResult => {
  const assetsGeo = new AssetsGeoIndex(
    hydraulicModel.assets,
    hydraulicModel.assetIndex,
  );
  const assetIds = queryContainedAssets(assetsGeo, points);
  const customerPointIds =
    includeCustomerPoints && hydraulicModel.customerPoints.size > 0
      ? queryContainedCustomerPoints(
          new CustomerPointsGeoIndex(hydraulicModel.customerPoints),
          points,
        )
      : [];
  return { assetIds, customerPointIds };
};

const runQueryWithWorker = async (
  encoded: EncodedAreaSelectionBuffers,
  points: Position[],
  signal?: AbortSignal,
): Promise<EncodedAreaSelectionResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "SpatialQueryWorker",
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
      encoded.customerPointsGeoBuffers
        ? Comlink.transfer(
            encoded.customerPointsGeoBuffers,
            customerPointsGeoTransferables(encoded.customerPointsGeoBuffers),
          )
        : undefined,
      points,
    );
  } catch (e) {
    throw enrichWorkerError("spatial-query", e);
  } finally {
    signal?.removeEventListener("abort", abortHandler);
    worker.terminate();
  }
};
