import { Position } from "src/types";
import {
  AssetsGeoBuffers,
  AssetsGeoView,
} from "src/hydraulic-model/assets-geo";
import {
  AssetIndexBuffers,
  AssetIndexView,
} from "src/hydraulic-model/asset-index";
import { EncodedContainedAssets } from "./data";
import {
  queryContainedAssets,
  queryIntersectedAssets,
} from "src/hydraulic-model/spatial-queries";

export interface SpatialQueryWorkerAPI {
  queryContainedAssets: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    points: Position[],
  ) => EncodedContainedAssets;
  queryIntersectedAssets: (
    assetIndexBuffers: AssetIndexBuffers,
    assetsGeoBuffers: AssetsGeoBuffers,
    points: Position[],
  ) => EncodedContainedAssets;
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

  return {
    assetIds: buffer.buffer,
    count: assetIds.length,
  };
}

function queryIntersectedAssetsFromBuffers(
  assetIndexBuffers: AssetIndexBuffers,
  assetsGeoBuffers: AssetsGeoBuffers,
  points: Position[],
): EncodedContainedAssets {
  const assetsGeoView = new AssetsGeoView(
    assetsGeoBuffers,
    new AssetIndexView(assetIndexBuffers),
  );

  const assetIds = queryIntersectedAssets(assetsGeoView, points);

  const buffer = new Uint32Array(assetIds);

  return {
    assetIds: buffer.buffer,
    count: assetIds.length,
  };
}

export const workerAPI: SpatialQueryWorkerAPI = {
  queryContainedAssets: queryContainedAssetsFromBuffers,
  queryIntersectedAssets: queryIntersectedAssetsFromBuffers,
};
