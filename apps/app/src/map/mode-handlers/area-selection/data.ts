import { HydraulicModel } from "src/hydraulic-model";
import {
  AssetIndexBuffers,
  AssetIndexEncoder,
} from "src/hydraulic-model/asset-index-transferable";
import { AssetId, AssetsMap, CustomerPoints } from "@epanet-js/hydraulic-model";
import {
  AssetsGeoBuffers,
  AssetsGeoEncoder,
  AssetsGeoIndex,
} from "src/hydraulic-model/assets-geo";
import {
  CustomerPointsGeoBuffers,
  cloneCustomerPointsGeoBuffers,
  encodeCustomerPointsGeo,
} from "src/hydraulic-model/customer-points-geo";
import { BinaryData, BufferType } from "src/lib/buffers/buffers";

// ─── Deprecated path (FLAG_MULTI_CP_SELECTION off) ───
// Byte-identical to the pre-feature version. No buffer caching here so the
// flag-off path is provably free of any new state or memory pressure.

export const encodeHydraulicModel = (
  hydraulicModel: HydraulicModel,
  bufferType: BufferType = "array",
): {
  assetsGeoBuffers: AssetsGeoBuffers;
  assetIndexBuffers: AssetIndexBuffers;
} => {
  const { assetIndex, assets } = hydraulicModel;
  const assetsGeoIndex = new AssetsGeoIndex(assets, assetIndex);

  const assetIndexEncoder = new AssetIndexEncoder(assetIndex, bufferType);
  const assetsGeoEncoder = new AssetsGeoEncoder(
    assetIndex,
    assetsGeoIndex,
    bufferType,
  );

  for (const [nodeId, nodeIndex] of hydraulicModel.assetIndex.iterateNodes()) {
    assetIndexEncoder.encodeNode(nodeId, nodeIndex);
    assetsGeoEncoder.encodeNode(nodeId, nodeIndex);
  }
  for (const [linkId, linkIndex] of hydraulicModel.assetIndex.iterateLinks()) {
    assetIndexEncoder.encodeLink(linkId, linkIndex);
    assetsGeoEncoder.encodeLink(linkId, linkIndex);
  }

  return {
    assetsGeoBuffers: assetsGeoEncoder.finalize(),
    assetIndexBuffers: assetIndexEncoder.finalize(),
  };
};

export type EncodedContainedAssets = {
  assetIds: BinaryData;
  count: number;
};

export const decodeContainedAssets = (
  encoded: EncodedContainedAssets,
): AssetId[] => {
  const { assetIds, count } = encoded;
  const view = new Uint32Array(assetIds);
  return Array.from(view.slice(0, count));
};

// ─── New path (FLAG_MULTI_CP_SELECTION on) ───
// Caches encoded buffers by AssetsMap / CustomerPoints identity so subsequent
// drags on the same model skip encoding. Buffers are cloned before transfer
// so the cache survives Comlink's ownership move.

export type EncodedAreaSelectionBuffers = {
  assetsGeoBuffers: AssetsGeoBuffers;
  assetIndexBuffers: AssetIndexBuffers;
  customerPointsGeoBuffers: CustomerPointsGeoBuffers;
};

const assetBuffersCache = new WeakMap<
  AssetsMap,
  { assetsGeoBuffers: AssetsGeoBuffers; assetIndexBuffers: AssetIndexBuffers }
>();
const customerPointBuffersCache = new WeakMap<
  CustomerPoints,
  CustomerPointsGeoBuffers
>();

export const getEncodedAreaSelectionBuffers = (
  hydraulicModel: HydraulicModel,
  bufferType: BufferType = "array",
): EncodedAreaSelectionBuffers => {
  let assetEntry = assetBuffersCache.get(hydraulicModel.assets);
  if (!assetEntry) {
    assetEntry = encodeHydraulicModel(hydraulicModel, bufferType);
    assetBuffersCache.set(hydraulicModel.assets, assetEntry);
  }
  let cpEntry = customerPointBuffersCache.get(hydraulicModel.customerPoints);
  if (!cpEntry) {
    cpEntry = encodeCustomerPointsGeo(
      hydraulicModel.customerPoints,
      bufferType,
    );
    customerPointBuffersCache.set(hydraulicModel.customerPoints, cpEntry);
  }
  return {
    assetsGeoBuffers: assetEntry.assetsGeoBuffers,
    assetIndexBuffers: assetEntry.assetIndexBuffers,
    customerPointsGeoBuffers: cpEntry,
  };
};

export const cloneEncodedAreaSelectionBuffers = (
  encoded: EncodedAreaSelectionBuffers,
): EncodedAreaSelectionBuffers => ({
  assetsGeoBuffers: cloneAssetsGeoBuffers(encoded.assetsGeoBuffers),
  assetIndexBuffers: cloneAssetIndexBuffers(encoded.assetIndexBuffers),
  customerPointsGeoBuffers: cloneCustomerPointsGeoBuffers(
    encoded.customerPointsGeoBuffers,
  ),
});

const cloneBinaryData = (data: BinaryData): BinaryData =>
  data instanceof ArrayBuffer ? data.slice(0) : data;

const cloneAssetsGeoBuffers = (b: AssetsGeoBuffers): AssetsGeoBuffers => ({
  nodesGeo: cloneBinaryData(b.nodesGeo),
  linksGeo: cloneBinaryData(b.linksGeo),
  segmentsGeo: cloneBinaryData(b.segmentsGeo),
  segmentsLinkIndex: cloneBinaryData(b.segmentsLinkIndex),
  linkSegments: {
    data: cloneBinaryData(b.linkSegments.data),
    index: cloneBinaryData(b.linkSegments.index),
  },
  nodesSpatialIndex: cloneBinaryData(b.nodesSpatialIndex),
  segmentsSpatialIndex: cloneBinaryData(b.segmentsSpatialIndex),
});

const cloneAssetIndexBuffers = (b: AssetIndexBuffers): AssetIndexBuffers => ({
  index: cloneBinaryData(b.index),
  linkIds: cloneBinaryData(b.linkIds),
  nodeIds: cloneBinaryData(b.nodeIds),
  linkTypes: cloneBinaryData(b.linkTypes),
  nodeTypes: cloneBinaryData(b.nodeTypes),
});

export type EncodedAreaSelectionResult = {
  assetIds: BinaryData;
  assetCount: number;
  customerPointIds: BinaryData;
  customerPointCount: number;
};

export const decodeAreaSelectionResult = (
  encoded: EncodedAreaSelectionResult,
): { assetIds: AssetId[]; customerPointIds: number[] } => {
  const assetIdsView = new Uint32Array(encoded.assetIds as ArrayBuffer);
  const cpIdsView = new Uint32Array(encoded.customerPointIds as ArrayBuffer);
  return {
    assetIds: Array.from(assetIdsView.slice(0, encoded.assetCount)),
    customerPointIds: Array.from(
      cpIdsView.slice(0, encoded.customerPointCount),
    ),
  };
};
