import { AssetId } from "../asset-types";
import { TopologyQueries } from "../topology";
import { crossingRules, stopRecorder } from "./crossing";
import {
  AllowedFlowDirectionQueries,
  TraceBarriers,
  TraceStart,
  TraceStopReason,
  BarrierTraceResult,
} from "./types";

export function trace(
  start: TraceStart,
  topology: TopologyQueries,
  status: AllowedFlowDirectionQueries,
  barriers: TraceBarriers,
): BarrierTraceResult {
  const rules = crossingRules(topology, status, barriers);
  const stops = stopRecorder<TraceStopReason>();
  const visitedNodes = new Set<AssetId>();
  const visitedLinks = new Set<AssetId>();
  const resultNodes: AssetId[] = [];
  const resultLinks: AssetId[] = [];

  const stack: {
    nodeId: AssetId;
    fromNodeId: AssetId | null;
    viaLinkId: AssetId | null;
  }[] = start.nodeIds.map((nodeId) => ({
    nodeId,
    fromNodeId: null,
    viaLinkId: null,
  }));

  // When starting from a link, mark it visited and seed both connected nodes
  for (const linkId of start.linkIds) {
    visitedLinks.add(linkId);
    resultLinks.push(linkId);

    const [startNode, endNode] = topology.getNodes(linkId);
    stack.push(
      { nodeId: startNode, fromNodeId: null, viaLinkId: null },
      { nodeId: endNode, fromNodeId: null, viaLinkId: null },
    );
  }

  while (stack.length > 0) {
    const { nodeId, fromNodeId, viaLinkId } = stack.pop()!;

    if (visitedNodes.has(nodeId)) continue;

    if (rules.isNodeBarrier(nodeId)) {
      if (fromNodeId !== null) {
        stops.record({
          assetId: nodeId,
          reason: "barrier",
          fromNodeId,
          viaLinkId,
        });
      }
      continue;
    }

    visitedNodes.add(nodeId);
    resultNodes.push(nodeId);

    for (const linkId of topology.getLinks(nodeId)) {
      if (visitedLinks.has(linkId)) continue;

      const reason = rules.linkStopReason(linkId, nodeId);
      if (reason !== null) {
        stops.record({
          assetId: linkId,
          reason,
          fromNodeId: nodeId,
          viaLinkId: null,
        });
        continue;
      }

      visitedLinks.add(linkId);
      resultLinks.push(linkId);

      const neighborId = rules.otherEnd(linkId, nodeId);
      if (!visitedNodes.has(neighborId)) {
        stack.push({
          nodeId: neighborId,
          fromNodeId: nodeId,
          viaLinkId: linkId,
        });
      }
    }
  }

  return {
    nodeIds: resultNodes,
    linkIds: resultLinks,
    stops: stops.notReached((assetId) => visitedLinks.has(assetId)),
  };
}
