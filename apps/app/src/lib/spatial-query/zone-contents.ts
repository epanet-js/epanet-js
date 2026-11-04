import { AssetId, HydraulicModel } from "src/hydraulic-model";
import {
  AssetsGeoView,
  CustomerPointsGeoView,
  ZonesGeoView,
  queryZoneContents,
} from "@epanet-js/hydraulic-model";
import { AssetIndexView } from "src/hydraulic-model/asset-index-transferable";
import { canUseWorker, enrichWorkerError } from "src/infra/worker";
import { BufferType } from "@epanet-js/buffers";
import { getSpatialQueryWorker } from "./get-worker";
import { transferArgs } from "./transfer";
import {
  cloneEncodedAreaSelectionBuffers,
  decodeAreaSelectionResult,
  getEncodedAreaSelectionBuffers,
} from "./data";

export type ZoneContentsResult = {
  assetIds: AssetId[];
  customerPointIds: number[];
};

export const runZoneContentsQuery = async (
  hydraulicModel: HydraulicModel,
  zoneIds: number[],
  includeCustomerPoints: boolean = true,
  bufferType: BufferType = "array",
): Promise<ZoneContentsResult> => {
  const cached = getEncodedAreaSelectionBuffers(
    hydraulicModel,
    bufferType,
    includeCustomerPoints,
    true,
  );
  if (!cached.zonesGeoBuffers || zoneIds.length === 0) {
    return { assetIds: [], customerPointIds: [] };
  }

  if (!canUseWorker()) {
    return queryZoneContents(
      new ZonesGeoView(cached.zonesGeoBuffers),
      new AssetsGeoView(
        cached.assetsGeoBuffers,
        new AssetIndexView(cached.assetIndexBuffers),
      ),
      cached.customerPointsGeoBuffers
        ? new CustomerPointsGeoView(cached.customerPointsGeoBuffers)
        : null,
      zoneIds,
    );
  }

  const { assetIndexArg, assetsGeoArg, customerPointsGeoArg, zonesGeoArg } =
    transferArgs(cloneEncodedAreaSelectionBuffers(cached));

  try {
    const { assetIds, customerPointIds } = decodeAreaSelectionResult(
      await getSpatialQueryWorker().queryZoneContents(
        assetIndexArg,
        assetsGeoArg,
        customerPointsGeoArg,
        zonesGeoArg!,
        zoneIds,
      ),
    );
    return { assetIds, customerPointIds };
  } catch (e) {
    throw enrichWorkerError("spatial-query", e);
  }
};
