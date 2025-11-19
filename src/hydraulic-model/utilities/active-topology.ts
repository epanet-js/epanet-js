import { AssetId, LinkAsset, NodeAsset } from "../asset-types";
import { AssetsMap } from "../hydraulic-model";
import { TopologyQueries } from "../topology/types";

export function inferNodeIsActiveFromRemainingConnections(
  node: NodeAsset,
  excludedConnections: Set<AssetId>,
  topology: TopologyQueries,
  assets: AssetsMap,
): boolean {
  const remainingConnectedLinkIds = topology
    .getLinks(node.id)
    .filter((linkId) => !excludedConnections.has(linkId));

  const isOrphanNode = remainingConnectedLinkIds.length == 0;

  if (isOrphanNode) return true;

  const hasOtherActiveLinks = remainingConnectedLinkIds.some((linkId) => {
    const link = assets.get(linkId) as LinkAsset;
    return link && link.isActive;
  });

  return hasOtherActiveLinks;
}
