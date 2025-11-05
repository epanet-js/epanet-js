import { OrphanAssets } from "./data";
import { AssetIndexQueries } from "src/hydraulic-model/asset-index";
import { TopologyQueries } from "src/hydraulic-model/topology/types";

export function findOrphanAssets(
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
): OrphanAssets {
  const orphanLinks: number[] = [];
  for (const [linkId] of assetIndex.iterateLinks()) {
    const linkType = assetIndex.getLinkType(linkId);
    if (linkType === "pipe") continue;

    const [startNode, endNode] = topology.getNodes(linkId);

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
