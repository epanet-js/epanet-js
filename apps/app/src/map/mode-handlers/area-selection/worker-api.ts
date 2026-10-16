import * as Comlink from "comlink";
import { Position } from "src/types";
import { AssetsGeoBuffers, AssetsGeoView } from "@epanet-js/hydraulic-model";
import {
  AssetIndexBuffers,
  AssetIndexView,
} from "src/hydraulic-model/asset-index-transferable";
import {
  CustomerPointsGeoBuffers,
  CustomerPointsGeoView,
  queryContainedCustomerPoints,
} from "@epanet-js/hydraulic-model";
import { queryContainedAssets } from "@epanet-js/hydraulic-model";
import { EncodedAreaSelectionResult } from "./data";

export interface SpatialQueryWorkerAPI {
  queryContainedFeatures: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    customerPointsGeoBuffers: CustomerPointsGeoBuffers | undefined,
    points: Position[],
  ) => EncodedAreaSelectionResult;
}

function queryContainedFeaturesFromBuffers(
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  customerPointsGeoBuffers: CustomerPointsGeoBuffers | undefined,
  points: Position[],
): EncodedAreaSelectionResult {
  const assetsGeoView = new AssetsGeoView(
    assetsGeoBuffers,
    new AssetIndexView(assetIndexBuffers),
  );

  const assetIds = queryContainedAssets(assetsGeoView, points);
  const customerPointIds = customerPointsGeoBuffers
    ? queryContainedCustomerPoints(
        new CustomerPointsGeoView(customerPointsGeoBuffers),
        points,
      )
    : [];

  const assetIdsBuffer = new Uint32Array(assetIds);
  const cpIdsBuffer = new Uint32Array(customerPointIds);
  const result: EncodedAreaSelectionResult = {
    assetIds: assetIdsBuffer.buffer,
    assetCount: assetIds.length,
    customerPointIds: cpIdsBuffer.buffer,
    customerPointCount: customerPointIds.length,
  };
  return Comlink.transfer(result, [assetIdsBuffer.buffer, cpIdsBuffer.buffer]);
}

export const workerAPI: SpatialQueryWorkerAPI = {
  queryContainedFeatures: queryContainedFeaturesFromBuffers,
};
