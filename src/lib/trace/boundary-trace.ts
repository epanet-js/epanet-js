import { AssetId } from "src/hydraulic-model/asset-types";
import { TopologyQueries } from "src/hydraulic-model/topology/types";
import {
  TraceStatusQueries,
  TraceStart,
  TraceResult,
  LinkTraversal,
  NodeTraversal,
} from "./types";

export function boundaryTrace(
  start: TraceStart,
  topology: TopologyQueries,
  status: TraceStatusQueries,
): TraceResult {
  const visitedNodes = new Set<AssetId>();
  const visitedLinks = new Set<AssetId>();
  const resultNodes: AssetId[] = [];
  const resultLinks: AssetId[] = [];

  // Include any pre-selected links (when starting from a link click)
  for (const linkId of start.linkIds) {
    visitedLinks.add(linkId);
    resultLinks.push(linkId);
  }

  const stack = [...start.nodeIds];

  while (stack.length > 0) {
    const nodeId = stack.pop()!;

    if (visitedNodes.has(nodeId)) continue;

    // Boundary nodes stop the trace and are excluded from the result
    const nodeTraversal = status.getNodeTraversal(nodeId);
    if (nodeTraversal === NodeTraversal.BOUNDARY) continue;

    visitedNodes.add(nodeId);
    resultNodes.push(nodeId);

    const connectedLinks = topology.getLinks(nodeId);
    for (const linkId of connectedLinks) {
      if (visitedLinks.has(linkId)) continue;

      const linkTraversalValue = status.getLinkTraversal(linkId);

      // Boundary links stop the trace and are excluded from the result
      if (linkTraversalValue === LinkTraversal.BOUNDARY) continue;

      // One-way (CV pipe): can only traverse from start node to end node
      if (linkTraversalValue === LinkTraversal.ONE_WAY) {
        const [startNode] = topology.getNodes(linkId);
        if (nodeId !== startNode) continue;
      }

      visitedLinks.add(linkId);
      resultLinks.push(linkId);

      const [startNode, endNode] = topology.getNodes(linkId);
      const neighborId = startNode === nodeId ? endNode : startNode;

      if (!visitedNodes.has(neighborId)) {
        stack.push(neighborId);
      }
    }
  }

  return { nodeIds: resultNodes, linkIds: resultLinks };
}
