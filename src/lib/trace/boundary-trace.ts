import { AssetId } from "src/hydraulic-model/asset-types";
import { AssetIndexQueries } from "src/hydraulic-model/asset-index";
import { TopologyQueries } from "src/hydraulic-model/topology/types";
import {
  AllowedFlowDirectionQueries,
  TraceStart,
  TraceResult,
  AllowedFlowDirection,
} from "./types";

export function boundaryTrace(
  start: TraceStart,
  topology: TopologyQueries,
  assetIndex: AssetIndexQueries,
  status: AllowedFlowDirectionQueries,
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

    // Boundary nodes (tanks, reservoirs) stop the trace
    const nodeType = assetIndex.getNodeType(nodeId);
    if (nodeType === "tank" || nodeType === "reservoir") continue;

    visitedNodes.add(nodeId);
    resultNodes.push(nodeId);

    const connectedLinks = topology.getLinks(nodeId);
    for (const linkId of connectedLinks) {
      if (visitedLinks.has(linkId)) continue;

      const direction = status.getAllowedFlowDirection(linkId);
      if (direction === AllowedFlowDirection.NONE) continue;

      // Block pumps and directional valves (non-TCV)
      const linkType = assetIndex.getLinkType(linkId);
      if (linkType === "pump") continue;
      if (linkType === "valve" && direction !== AllowedFlowDirection.BOTH)
        continue;

      // DOWNSTREAM (CV pipe): can only traverse from start node
      if (direction === AllowedFlowDirection.DOWNSTREAM) {
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
