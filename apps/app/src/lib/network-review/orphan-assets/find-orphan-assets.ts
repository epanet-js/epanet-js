import { OrphanAssets } from "./data";
import { AssetIndexQueries } from "@epanet-js/hydraulic-model";
import { TopologyQueries } from "@epanet-js/hydraulic-model";

export function findOrphanAssets(
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
): OrphanAssets {
  const orphanLinks: number[] = [];
  for (const [linkId] of assetIndex.iterateLinks()) {
    const [startNode, endNode] = topology.getNodes(linkId);

    if (!assetIndex.hasNode(startNode) || !assetIndex.hasNode(endNode)) {
      orphanLinks.push(linkId);
      continue;
    }

    const linkType = assetIndex.getLinkType(linkId);
    if (linkType === "pipe") continue;

    const startNodeConnections = topology.getLinks(startNode).length;
    const endNodeConnections = topology.getLinks(endNode).length;

    if (startNodeConnections <= 1 && endNodeConnections <= 1) {
      orphanLinks.push(linkId);
    }
  }

  const orphanNodes: number[] = [];
  for (const [nodeId] of assetIndex.iterateNodes()) {
    const connections = topology.getLinks(nodeId);
    if (connections.length === 0) orphanNodes.push(nodeId);
  }

  return { orphanNodes, orphanLinks };
}
