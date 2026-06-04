import * as Comlink from "comlink";
import { Position } from "src/types";
import {
  AssetsGeoBuffers,
  AssetsGeoView,
} from "src/hydraulic-model/assets-geo";
import {
  AssetIndexBuffers,
  AssetIndexView,
} from "src/hydraulic-model/asset-index-transferable";
import {
  CustomerPointsGeoBuffers,
  queryContainedCustomerPointsFromBuffers,
} from "src/hydraulic-model/customer-points-geo";
import { queryContainedAssets } from "src/hydraulic-model/spatial-queries";
import { EncodedAreaSelectionResult, EncodedContainedAssets } from "./data";

export interface SpatialQueryWorkerAPI {
  // Deprecated: asset-only path (FLAG_MULTI_CP_SELECTION off).
  queryContainedAssets: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    points: Position[],
  ) => EncodedContainedAssets;
  // New: combined assets + customer points (FLAG_MULTI_CP_SELECTION on).
  queryContainedFeatures: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    customerPointsGeoBuffers: CustomerPointsGeoBuffers,
    points: Position[],
  ) => EncodedAreaSelectionResult;
}

function queryContainedAssetsFromBuffers(
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  points: Position[],
): EncodedContainedAssets {
  const assetsGeoView = new AssetsGeoView(
    assetsGeoBuffers,
    new AssetIndexView(assetIndexBuffers),
  );

  const assetIds = queryContainedAssets(assetsGeoView, points);

  const buffer = new Uint32Array(assetIds);
  const result: EncodedContainedAssets = {
    assetIds: buffer.buffer,
    count: assetIds.length,
  };
  return Comlink.transfer(result, [buffer.buffer]);
}

function queryContainedFeaturesFromBuffers(
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  customerPointsGeoBuffers: CustomerPointsGeoBuffers,
  points: Position[],
): EncodedAreaSelectionResult {
  const assetsGeoView = new AssetsGeoView(
    assetsGeoBuffers,
    new AssetIndexView(assetIndexBuffers),
  );

  const assetIds = queryContainedAssets(assetsGeoView, points);
  const customerPointIds = queryContainedCustomerPointsFromBuffers(
    customerPointsGeoBuffers,
    points,
  );

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
  queryContainedAssets: queryContainedAssetsFromBuffers,
  queryContainedFeatures: queryContainedFeaturesFromBuffers,
};
