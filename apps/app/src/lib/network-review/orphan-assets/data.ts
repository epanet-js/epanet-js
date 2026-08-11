import { AssetType, AssetId } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { BufferType } from "@epanet-js/buffers";
import {
  TopologyEncoder,
  TopologyBuffers,
} from "src/hydraulic-model/topology/topology-transferable";
import {
  AssetIndexEncoder,
  AssetIndexBuffers,
} from "src/hydraulic-model/asset-index-transferable";

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

enum typeOrder {
  "reservoir" = 5,
  "tank" = 4,
  "valve" = 3,
  "pump" = 2,
  "junction" = 1,
  "pipe" = 0,
}

type SortKey = { assetId: AssetId; type: AssetType; label: string };

export function buildOrphanAssets(
  model: HydraulicModel,
  rawOrphanAssets: OrphanAssets,
): AssetId[] {
  const sortKeys: SortKey[] = [];

  const { orphanNodes, orphanLinks } = rawOrphanAssets;

  [...orphanLinks, ...orphanNodes].forEach((assetId) => {
    const asset = model.assets.get(assetId);
    if (asset) {
      sortKeys.push({ assetId, type: asset.type, label: asset.label });
    }
  });

  return sortKeys
    .sort((a: SortKey, b: SortKey) => {
      const labelA = a.label.toUpperCase();
      const labelB = b.label.toUpperCase();

      if (a.type !== b.type) {
        return typeOrder[a.type] > typeOrder[b.type] ? -1 : 1;
      }
      return labelA < labelB ? -1 : labelA > labelB ? 1 : 0;
    })
    .map((sortKey) => sortKey.assetId);
}
