import { AssetType, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { TopologyBuffers } from "src/hydraulic-model/topology/types";
import { BufferType } from "src/lib/buffers";
import { TopologyEncoder } from "src/hydraulic-model/topology/topologyEncoder";
import {
  AssetIndexEncoder,
  AssetIndexBuffers,
} from "src/hydraulic-model/asset-index";

export type OrphanAssets = {
  orphanNodes: number[];
  orphanLinks: number[];
};

export type RunData = {
  topologyBuffers: TopologyBuffers;
  assetIndexBuffers: AssetIndexBuffers;
};

export function encodeData(
  model: HydraulicModel,
  bufferType: BufferType = "array",
): RunData {
  model.assetIndex.updateAssetsMapReference(model.assets);
  const assetIndexEncoder = new AssetIndexEncoder(model.assetIndex, bufferType);
  const topologyEncoder = new TopologyEncoder(
    model.topology,
    model.assetIndex,
    bufferType,
  );

  return {
    topologyBuffers: topologyEncoder.encode(),
    assetIndexBuffers: assetIndexEncoder.encode(),
  };
}

export interface OrphanAsset {
  assetId: AssetId;
  type: AssetType;
  label: string;
}

enum typeOrder {
  "reservoir" = 5,
  "tank" = 4,
  "valve" = 3,
  "pump" = 2,
  "junction" = 1,
  "pipe" = 0,
}

export function buildOrphanAssets(
  model: HydraulicModel,
  rawOrphanAssets: OrphanAssets,
): OrphanAsset[] {
  const orphanAssets: OrphanAsset[] = [];

  const { orphanNodes, orphanLinks } = rawOrphanAssets;

  orphanLinks.forEach((linkId) => {
    const linkAsset = model.assets.get(linkId);
    if (linkAsset) {
      orphanAssets.push({
        assetId: linkId,
        type: linkAsset.type,
        label: linkAsset.label,
      });
    }
  });

  orphanNodes.forEach((nodeId) => {
    const nodeAsset = model.assets.get(nodeId);
    if (nodeAsset) {
      orphanAssets.push({
        assetId: nodeId,
        type: nodeAsset.type,
        label: nodeAsset.label,
      });
    }
  });

  return orphanAssets.sort((a: OrphanAsset, b: OrphanAsset) => {
    const labelA = a.label.toUpperCase();
    const labelB = b.label.toUpperCase();

    if (a.type !== b.type) {
      return typeOrder[a.type] > typeOrder[b.type] ? -1 : 1;
    }
    return labelA < labelB ? -1 : labelA > labelB ? 1 : 0;
  });
}
