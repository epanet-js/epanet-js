import { AssetType, AssetId } from "src/hydraulic-model/asset-types";
import { HydraulicModel } from "src/hydraulic-model";
import { BinaryData, BufferWithIndex } from "../shared";

export type RunData = {
  linksConnections: BinaryData;
  linkTypes: BinaryData;
  nodeConnections: BufferWithIndex;
};

export type EncodedOrphanAssets = {
  orphanNodes: number[];
  orphanLinks: number[];
};

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

export function decodeOrphanAssets(
  model: HydraulicModel,
  nodeIdsLookup: string[],
  linkIdsLookup: string[],
  encodedOrphanAssets: EncodedOrphanAssets,
): OrphanAsset[] {
  const orphanAssets: OrphanAsset[] = [];

  const { orphanNodes, orphanLinks } = encodedOrphanAssets;

  orphanLinks.forEach((linkIdx) => {
    const linkId = linkIdsLookup[linkIdx];
    const linkAsset = model.assets.get(linkId);
    if (linkAsset) {
      orphanAssets.push({
        assetId: linkId,
        type: linkAsset.type,
        label: linkAsset.label,
      });
    }
  });

  orphanNodes.forEach((nodeIdx) => {
    const nodeId = nodeIdsLookup[nodeIdx];
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
