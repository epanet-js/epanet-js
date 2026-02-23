import { AssetId } from "src/hydraulic-model/asset-types";
import { TopologyQueries } from "src/hydraulic-model/topology/types";
import {
  FlowDirectionQueries,
  TraceStart,
  TraceResult,
  FlowDirection,
} from "./types";

export function upstreamTrace(
  start: TraceStart,
  topology: TopologyQueries,
  status: FlowDirectionQueries,
): TraceResult {
  const visitedNodes = new Set<AssetId>();
  const visitedLinks = new Set<AssetId>();
  const resultNodes: AssetId[] = [];
  const resultLinks: AssetId[] = [];

  const stack = [...start.nodeIds];

  // When starting from a link, determine the upstream node from flow direction
  for (const linkId of start.linkIds) {
    visitedLinks.add(linkId);
    resultLinks.push(linkId);

    const [startNode, endNode] = topology.getNodes(linkId);
    const direction = status.getFlowDirection(linkId);

    if (direction === FlowDirection.DOWNSTREAM) {
      stack.push(startNode);
    } else if (direction === FlowDirection.UPSTREAM) {
      stack.push(endNode);
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

      // Determine if water ENTERS this node through this link.
      // POSITIVE = start→end. NEGATIVE = end→start.
      const waterEntersNode =
        (nodeId === endNode && direction === FlowDirection.DOWNSTREAM) ||
        (nodeId === startNode && direction === FlowDirection.UPSTREAM);

      if (!waterEntersNode) continue;

      visitedLinks.add(linkId);
      resultLinks.push(linkId);

      // Follow upstream to the neighbor node where water comes from
      const neighborId = startNode === nodeId ? endNode : startNode;
      if (!visitedNodes.has(neighborId)) {
        stack.push(neighborId);
      }
    }
  }

  return { nodeIds: resultNodes, linkIds: resultLinks };
}
