import { Asset, AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { AssetsMap } from "../hydraulic-model";
import { TopologyQueries } from "../topology/types";

export function inferNodeIsActive(
  node: NodeAsset,
  deletedAssetIds: Set<AssetId>,
  updatedAssets: Asset[],
  topology: TopologyQueries,
  assets: AssetsMap,
): boolean {
  const nodeNewConnections = updatedAssets.filter((asset) => {
    return asset.isLink && (asset as LinkAsset).connections.includes(node.id);
  }) as LinkAsset[];

  const nodeHasNewActiveConnections = nodeNewConnections.some(
    (link) => link.isActive,
  );
  if (nodeHasNewActiveConnections) return true;

  const remainingConnectedLinkIds = topology
    .getLinks(node.id)
    .filter((linkId) => !deletedAssetIds.has(linkId));

  const isOrphanNode =
    remainingConnectedLinkIds.length === 0 && nodeNewConnections.length === 0;

  if (isOrphanNode) return true;

  const hasOtherActiveLinks = remainingConnectedLinkIds.some((linkId) => {
    const link = assets.get(linkId) as LinkAsset;
    return link && link.isActive;
  });

  return hasOtherActiveLinks;
}
