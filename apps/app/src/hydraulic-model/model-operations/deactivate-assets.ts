import { AssetId } from "../asset-types";
import { AssetsMap } from "../assets-map";
import type { AssetPatch } from "../model-operation";
import { ModelOperation } from "../model-operation";
import { TopologyQueries } from "../topology/types";

type InputData = {
  assetIds: AssetId[];
};

export const deactivateAssets: ModelOperation<InputData> = (
  { assets, topology },
  { assetIds },
) => {
  const patches: AssetPatch[] = [];
  const linksToDeactivate = new Set<AssetId>();
  const nodesToCheck = new Set<AssetId>();

  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) throw new Error(`Invalid asset id ${assetId}`);

    if (!asset.isLink) continue;

    const [startNodeId, endNodeId] = topology.getNodes(assetId);
    const startNode = assets.get(startNodeId);
    const endNode = assets.get(endNodeId);

    if (asset.isActive) {
      linksToDeactivate.add(assetId);
      patches.push({
        id: assetId,
        type: asset.type,
        properties: { isActive: false },
      } as AssetPatch);
    }

    if (startNode?.isActive) nodesToCheck.add(startNodeId);
    if (endNode?.isActive) nodesToCheck.add(endNodeId);
  }

  for (const nodeId of nodesToCheck) {
    const hasActiveLink = hasActiveLinkConnected(
      topology,
      assets,
      nodeId,
      linksToDeactivate,
    );

    if (!hasActiveLink) {
      const node = assets.get(nodeId)!;
      patches.push({
        id: nodeId,
        type: node.type,
        properties: { isActive: false },
      } as AssetPatch);
    }
  }

  return { note: "Deactivate assets", patchAssetsAttributes: patches };
};

function hasActiveLinkConnected(
  topology: TopologyQueries,
  assets: AssetsMap,
  nodeId: AssetId,
  linksToDeactivate: Set<AssetId>,
): boolean {
  const connectedLinks = topology.getLinks(nodeId);
  for (const linkId of connectedLinks) {
    if (linksToDeactivate.has(linkId)) continue;
    const link = assets.get(linkId);
    if (link?.isActive) {
      return true;
    }
  }
  return false;
}
