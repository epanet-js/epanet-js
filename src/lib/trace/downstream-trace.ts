import { AssetId } from "src/hydraulic-model/asset-types";
import { TopologyQueries } from "src/hydraulic-model/topology/types";
import {
  TraceStatusQueries,
  TraceStart,
  TraceResult,
  FlowDirection,
} from "./types";

export function downstreamTrace(
  start: TraceStart,
  topology: TopologyQueries,
  status: TraceStatusQueries,
): TraceResult {
  const visitedNodes = new Set<AssetId>();
  const visitedLinks = new Set<AssetId>();
  const resultNodes: AssetId[] = [];
  const resultLinks: AssetId[] = [];

  const stack = [...start.nodeIds];

  // When starting from a link, determine the downstream node from flow direction
  for (const linkId of start.linkIds) {
    visitedLinks.add(linkId);
    resultLinks.push(linkId);

    const [startNode, endNode] = topology.getNodes(linkId);
    const direction = status.getFlowDirection(linkId);

    if (direction === FlowDirection.DOWNSTREAM) {
      stack.push(endNode);
    } else if (direction === FlowDirection.UPSTREAM) {
      stack.push(startNode);
    }
  }

  while (stack.length > 0) {
    const nodeId = stack.pop()!;

    if (visitedNodes.has(nodeId)) continue;
    visitedNodes.add(nodeId);
    resultNodes.push(nodeId);

    const connectedLinks = topology.getLinks(nodeId);
    for (const linkId of connectedLinks) {
      if (visitedLinks.has(linkId)) continue;

      const [startNode, endNode] = topology.getNodes(linkId);
      const direction = status.getFlowDirection(linkId);

      if (direction === FlowDirection.NONE) continue;

      // Determine if water EXITS this node through this link.
      // POSITIVE = start→end. NEGATIVE = end→start.
      const waterExitsNode =
        (nodeId === startNode && direction === FlowDirection.DOWNSTREAM) ||
        (nodeId === endNode && direction === FlowDirection.UPSTREAM);

      if (!waterExitsNode) continue;

      visitedLinks.add(linkId);
      resultLinks.push(linkId);

      // Follow downstream to the neighbor node where water goes
      const neighborId = startNode === nodeId ? endNode : startNode;
      if (!visitedNodes.has(neighborId)) {
        stack.push(neighborId);
      }
    }
  }

  return { nodeIds: resultNodes, linkIds: resultLinks };
}
