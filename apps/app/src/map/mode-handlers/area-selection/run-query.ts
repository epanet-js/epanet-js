import * as Comlink from "comlink";
import { Position } from "src/types";
import { AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import {
  AssetsGeoIndex,
  assetsGeoTransferables,
} from "@epanet-js/hydraulic-model";
import { assetIndexTransferables } from "src/hydraulic-model/asset-index-transferable";
import {
  CustomerPointsGeoIndex,
  customerPointsGeoTransferables,
  queryContainedCustomerPoints,
} from "@epanet-js/hydraulic-model";
import { queryContainedAssets } from "@epanet-js/hydraulic-model";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import { getSpatialQueryWorker } from "./get-worker";
import {
  EncodedAreaSelectionBuffers,
  EncodedAreaSelectionResult,
  cloneEncodedAreaSelectionBuffers,
  decodeAreaSelectionResult,
  getEncodedAreaSelectionBuffers,
} from "./data";
import { BufferType } from "@epanet-js/buffers";

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

  const assetIndexArg = Comlink.transfer(
    encoded.assetIndexBuffers,
    assetIndexTransferables(encoded.assetIndexBuffers),
  );
  const assetsGeoArg = Comlink.transfer(
    encoded.assetsGeoBuffers,
    assetsGeoTransferables(encoded.assetsGeoBuffers),
  );
  const customerPointsGeoArg = encoded.customerPointsGeoBuffers
    ? Comlink.transfer(
        encoded.customerPointsGeoBuffers,
        customerPointsGeoTransferables(encoded.customerPointsGeoBuffers),
      )
    : undefined;

  const workerAPI = getSpatialQueryWorker();
  try {
    const result = await workerAPI.queryContainedFeatures(
      assetIndexArg,
      assetsGeoArg,
      customerPointsGeoArg,
      points,
    );
    if (signal?.aborted) {
      throw new DOMException("Operation cancelled", "AbortError");
    }
    return result;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw enrichWorkerError("spatial-query", e);
  }
};
