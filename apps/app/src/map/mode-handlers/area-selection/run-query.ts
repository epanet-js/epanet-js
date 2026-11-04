import { Position } from "src/types";
import { AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model/hydraulic-model";
import { AssetsGeoIndex } from "@epanet-js/hydraulic-model";
import {
  CustomerPointsGeoIndex,
  queryContainedCustomerPoints,
} from "@epanet-js/hydraulic-model";
import { queryContainedAssets } from "@epanet-js/hydraulic-model";
import {
  ZonesGeoView,
  queryIntersectingZones,
} from "@epanet-js/hydraulic-model";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import { getSpatialQueryWorker } from "src/lib/spatial-query/get-worker";
import { transferArgs } from "src/lib/spatial-query/transfer";
import {
  EncodedAreaSelectionBuffers,
  EncodedAreaSelectionResult,
  cloneEncodedAreaSelectionBuffers,
  decodeAreaSelectionResult,
  getEncodedAreaSelectionBuffers,
  getEncodedZonesGeoBuffers,
} from "src/lib/spatial-query/data";
import { BufferType } from "@epanet-js/buffers";

export type AreaSelectionResult = {
  assetIds: AssetId[];
  customerPointIds: number[];
  zoneIds: number[];
};

export const runQuery = async (
  hydraulicModel: HydraulicModel,
  points: Position[],
  signal: AbortSignal | undefined = undefined,
  bufferType: BufferType = "array",
  includeCustomerPoints: boolean = true,
  includeZones: boolean = false,
): Promise<AreaSelectionResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  if (!canUseWorker()) {
    return runQueryInProcess(
      hydraulicModel,
      points,
      includeCustomerPoints,
      includeZones,
    );
  }

  const cached = getEncodedAreaSelectionBuffers(
    hydraulicModel,
    bufferType,
    includeCustomerPoints,
    includeZones,
  );
  const encoded = cloneEncodedAreaSelectionBuffers(cached);

  const encodedResult = await runQueryWithWorker(encoded, points, signal);
  return decodeAreaSelectionResult(encodedResult);
};

const runQueryInProcess = (
  hydraulicModel: HydraulicModel,
  points: Position[],
  includeCustomerPoints: boolean,
  includeZones: boolean,
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
  const zoneIds =
    includeZones && hydraulicModel.zones.size > 0
      ? queryIntersectingZones(
          new ZonesGeoView(getEncodedZonesGeoBuffers(hydraulicModel.zones)),
          points,
        )
      : [];
  return { assetIds, customerPointIds, zoneIds };
};

const runQueryWithWorker = async (
  encoded: EncodedAreaSelectionBuffers,
  points: Position[],
  signal?: AbortSignal,
): Promise<EncodedAreaSelectionResult> => {
  if (signal?.aborted) {
    throw new DOMException("Operation cancelled", "AbortError");
  }

  const { assetIndexArg, assetsGeoArg, customerPointsGeoArg, zonesGeoArg } =
    transferArgs(encoded);

  const workerAPI = getSpatialQueryWorker();
  try {
    const result = await workerAPI.queryContainedFeatures(
      assetIndexArg,
      assetsGeoArg,
      customerPointsGeoArg,
      zonesGeoArg,
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
