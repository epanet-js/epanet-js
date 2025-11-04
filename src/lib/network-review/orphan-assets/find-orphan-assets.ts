import { OrphanAssets } from "./data";
import { AssetIndexBaseQueries } from "src/hydraulic-model/asset-index";
import { AssetTypeBaseQueries } from "src/hydraulic-model/asset-type-queries";
import { TopologyBaseQueries } from "src/hydraulic-model/topology/types";

export function findOrphanAssets(
  topology: TopologyBaseQueries,
  assetIndex: AssetIndexBaseQueries,
  assetTypes: AssetTypeBaseQueries,
): OrphanAssets {
  const orphanLinks: number[] = [];
  for (const [linkId] of assetIndex.iterateLinks()) {
    const linkType = assetTypes.getLinkType(linkId);
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
