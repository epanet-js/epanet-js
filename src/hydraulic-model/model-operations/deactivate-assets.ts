import { Asset, AssetId } from "../asset-types";
import { AssetsMap } from "../assets-map";
import { ModelOperation } from "../model-operation";
import { TopologyQueries } from "../topology/types";

type InputData = {
  assetIds: AssetId[];
};

export const deactivateAssets: ModelOperation<InputData> = (
  { assets, topology },
  { assetIds },
) => {
  const updatedAssets: Asset[] = [];
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
      updatedAssets.push(deactivateAsset(asset));
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
      updatedAssets.push(deactivateAsset(node));
    }
  }

  return { note: "Deactivate assets", putAssets: updatedAssets };
};

const deactivateAsset = (asset: Asset): Asset => {
  const updated = asset.copy();
  updated.setProperty("isActive", false);
  return updated;
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
