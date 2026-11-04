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
  queryIntersectingZones,
  queryZoneContents,
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
  queryZoneContents: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    customerPointsGeoBuffers: CustomerPointsGeoBuffers | undefined,
    zonesGeoBuffers: ZonesGeoBuffers,
    zoneIds: number[],
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
    ? queryIntersectingZones(new ZonesGeoView(zonesGeoBuffers), points)
    : [];

  return encodeResult(assetIds, customerPointIds, zoneIds);
}

function queryZoneContentsFromBuffers(
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  customerPointsGeoBuffers: CustomerPointsGeoBuffers | undefined,
  zonesGeoBuffers: ZonesGeoBuffers,
  zoneIds: number[],
): EncodedAreaSelectionResult {
  const { assetIds, customerPointIds } = queryZoneContents(
    new ZonesGeoView(zonesGeoBuffers),
    new AssetsGeoView(assetsGeoBuffers, new AssetIndexView(assetIndexBuffers)),
    customerPointsGeoBuffers
      ? new CustomerPointsGeoView(customerPointsGeoBuffers)
      : null,
    zoneIds,
  );
  return encodeResult(assetIds, customerPointIds, []);
}

function encodeResult(
  assetIds: number[],
  customerPointIds: number[],
  zoneIds: number[],
): EncodedAreaSelectionResult {
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
  queryZoneContents: queryZoneContentsFromBuffers,
};
