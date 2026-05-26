import { HydraulicModel } from "src/hydraulic-model";
import {
  AssetIndexBuffers,
  AssetIndexEncoder,
} from "src/hydraulic-model/asset-index";
import { AssetId } from "src/hydraulic-model/asset-types";
import {
  AssetsGeoBuffers,
  AssetsGeoEncoder,
  AssetsGeoIndex,
} from "src/hydraulic-model/assets-geo";
import { BinaryData, BufferType } from "src/lib/buffers/buffers";

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
