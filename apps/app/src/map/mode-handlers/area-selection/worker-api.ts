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
  ZonesGeoBuffers,
  ZonesGeoView,
  queryContainedZones,
} from "@epanet-js/hydraulic-model";
import { queryContainedAssets } from "@epanet-js/hydraulic-model";
import { EncodedAreaSelectionResult } from "./data";

export interface SpatialQueryWorkerAPI {
  queryContainedFeatures: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    customerPointsGeoBuffers: CustomerPointsGeoBuffers | undefined,
    zonesGeoBuffers: ZonesGeoBuffers | undefined,
    points: Position[],
  ) => EncodedAreaSelectionResult;
}

function queryContainedFeaturesFromBuffers(
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  customerPointsGeoBuffers: CustomerPointsGeoBuffers | undefined,
  zonesGeoBuffers: ZonesGeoBuffers | undefined,
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
  const zoneIds = zonesGeoBuffers
    ? queryContainedZones(new ZonesGeoView(zonesGeoBuffers), points)
    : [];

  const assetIdsBuffer = new Uint32Array(assetIds);
  const cpIdsBuffer = new Uint32Array(customerPointIds);
  const zoneIdsBuffer = new Uint32Array(zoneIds);
  const result: EncodedAreaSelectionResult = {
    assetIds: assetIdsBuffer.buffer,
    assetCount: assetIds.length,
    customerPointIds: cpIdsBuffer.buffer,
    customerPointCount: customerPointIds.length,
    zoneIds: zoneIdsBuffer.buffer,
    zoneCount: zoneIds.length,
  };
  return Comlink.transfer(result, [
    assetIdsBuffer.buffer,
    cpIdsBuffer.buffer,
    zoneIdsBuffer.buffer,
  ]);
}

export const workerAPI: SpatialQueryWorkerAPI = {
  queryContainedFeatures: queryContainedFeaturesFromBuffers,
};
