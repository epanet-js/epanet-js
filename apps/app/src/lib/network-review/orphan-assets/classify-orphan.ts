import { AssetId } from "@epanet-js/hydraulic-model";
import { AssetIndexQueries } from "@epanet-js/hydraulic-model";
import { TopologyQueries } from "@epanet-js/hydraulic-model";

export type OrphanKind = "isolatedNode" | "danglingLink" | "isolatedLink";

export function classifyOrphan(
  assetId: AssetId,
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
): OrphanKind | null {
  if (assetIndex.hasNode(assetId)) {
    return topology.getLinks(assetId).length === 0 ? "isolatedNode" : null;
  }

  if (!assetIndex.hasLink(assetId)) return null;

  const [startNode, endNode] = topology.getNodes(assetId);
  if (!assetIndex.hasNode(startNode) || !assetIndex.hasNode(endNode)) {
    return "danglingLink";
  }

  if (assetIndex.getAssetType(assetId) === "pipe") return null;

  const startNodeConnections = topology.getLinks(startNode).length;
  const endNodeConnections = topology.getLinks(endNode).length;

  return startNodeConnections <= 1 && endNodeConnections <= 1
    ? "isolatedLink"
    : null;
}
