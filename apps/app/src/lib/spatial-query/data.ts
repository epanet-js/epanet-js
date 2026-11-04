import { HydraulicModel } from "src/hydraulic-model";
import {
  AssetIndexBuffers,
  AssetIndexEncoder,
} from "src/hydraulic-model/asset-index-transferable";
import {
  AssetId,
  AssetsMap,
  CustomerPoints,
  Zones,
  ZonesGeoBuffers,
  ZonesGeoView,
  cloneZonesGeoBuffers,
  encodeZonesGeo,
} from "@epanet-js/hydraulic-model";
import {
  AssetsGeoBuffers,
  AssetsGeoEncoder,
  AssetsGeoIndex,
} from "@epanet-js/hydraulic-model";
import {
  CustomerPointsGeoBuffers,
  cloneCustomerPointsGeoBuffers,
  encodeCustomerPointsGeo,
} from "@epanet-js/hydraulic-model";
import { BinaryData, BufferType } from "@epanet-js/buffers";

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

// Caches encoded buffers by AssetsMap / CustomerPoints identity so subsequent
// drags on the same model skip encoding. Buffers are cloned before transfer
// so the cache survives Comlink's ownership move.

export type EncodedAreaSelectionBuffers = {
  assetsGeoBuffers: AssetsGeoBuffers;
  assetIndexBuffers: AssetIndexBuffers;
  customerPointsGeoBuffers?: CustomerPointsGeoBuffers;
  zonesGeoBuffers?: ZonesGeoBuffers;
};

const assetBuffersCache = new WeakMap<
  AssetsMap,
  { assetsGeoBuffers: AssetsGeoBuffers; assetIndexBuffers: AssetIndexBuffers }
>();
const customerPointBuffersCache = new WeakMap<
  CustomerPoints,
  CustomerPointsGeoBuffers
>();
const zoneBuffersCache = new WeakMap<Zones, ZonesGeoBuffers>();

export const getEncodedZonesGeoBuffers = (
  zones: Zones,
  bufferType: BufferType = "array",
): ZonesGeoBuffers => {
  let entry = zoneBuffersCache.get(zones);
  if (!entry) {
    entry = encodeZonesGeo(zones, bufferType);
    zoneBuffersCache.set(zones, entry);
  }
  return entry;
};

const zonesViewCache = new WeakMap<Zones, ZonesGeoView>();

export const getZonesGeoView = (zones: Zones): ZonesGeoView => {
  let view = zonesViewCache.get(zones);
  if (!view) {
    view = new ZonesGeoView(getEncodedZonesGeoBuffers(zones));
    zonesViewCache.set(zones, view);
  }
  return view;
};

export const getEncodedAreaSelectionBuffers = (
  hydraulicModel: HydraulicModel,
  bufferType: BufferType = "array",
  includeCustomerPoints: boolean = true,
  includeZones: boolean = false,
): EncodedAreaSelectionBuffers => {
  let assetEntry = assetBuffersCache.get(hydraulicModel.assets);
  if (!assetEntry) {
    assetEntry = encodeHydraulicModel(hydraulicModel, bufferType);
    assetBuffersCache.set(hydraulicModel.assets, assetEntry);
  }
  const encoded: EncodedAreaSelectionBuffers = {
    assetsGeoBuffers: assetEntry.assetsGeoBuffers,
    assetIndexBuffers: assetEntry.assetIndexBuffers,
  };
  if (includeCustomerPoints && hydraulicModel.customerPoints.size > 0) {
    let cpEntry = customerPointBuffersCache.get(hydraulicModel.customerPoints);
    if (!cpEntry) {
      cpEntry = encodeCustomerPointsGeo(
        hydraulicModel.customerPoints,
        bufferType,
      );
      customerPointBuffersCache.set(hydraulicModel.customerPoints, cpEntry);
    }
    encoded.customerPointsGeoBuffers = cpEntry;
  }
  if (includeZones && hydraulicModel.zones.size > 0) {
    encoded.zonesGeoBuffers = getEncodedZonesGeoBuffers(
      hydraulicModel.zones,
      bufferType,
    );
  }
  return encoded;
};

export const cloneEncodedAreaSelectionBuffers = (
  encoded: EncodedAreaSelectionBuffers,
): EncodedAreaSelectionBuffers => ({
  assetsGeoBuffers: cloneAssetsGeoBuffers(encoded.assetsGeoBuffers),
  assetIndexBuffers: cloneAssetIndexBuffers(encoded.assetIndexBuffers),
  customerPointsGeoBuffers: encoded.customerPointsGeoBuffers
    ? cloneCustomerPointsGeoBuffers(encoded.customerPointsGeoBuffers)
    : undefined,
  zonesGeoBuffers: encoded.zonesGeoBuffers
    ? cloneZonesGeoBuffers(encoded.zonesGeoBuffers)
    : undefined,
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
  zoneIds: BinaryData;
  zoneCount: number;
};

export const decodeAreaSelectionResult = (
  encoded: EncodedAreaSelectionResult,
): { assetIds: AssetId[]; customerPointIds: number[]; zoneIds: number[] } => {
  const assetIdsView = new Uint32Array(encoded.assetIds as ArrayBuffer);
  const cpIdsView = new Uint32Array(encoded.customerPointIds as ArrayBuffer);
  const zoneIdsView = new Uint32Array(encoded.zoneIds as ArrayBuffer);
  return {
    assetIds: Array.from(assetIdsView.slice(0, encoded.assetCount)),
    customerPointIds: Array.from(
      cpIdsView.slice(0, encoded.customerPointCount),
    ),
    zoneIds: Array.from(zoneIdsView.slice(0, encoded.zoneCount)),
  };
};
