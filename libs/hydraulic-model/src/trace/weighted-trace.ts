import { AssetId } from "../asset-types";
import { MinHeap } from "../min-heap";
import { TopologyQueries } from "../topology";
import { crossingRules, stopRecorder } from "./crossing";
import {
  AllowedFlowDirectionQueries,
  TraceBarriers,
  TraceLimits,
  TraceStart,
  WeightedTraceResult,
  WeightedTraceStopReason,
} from "./types";

export function weightedTrace(
  start: TraceStart,
  topology: TopologyQueries,
  status: AllowedFlowDirectionQueries,
  barriers: TraceBarriers,
  { maxDistance, maxHops, lengthOf }: TraceLimits,
): WeightedTraceResult {
  const rules = crossingRules(topology, status, barriers);
  const stops = stopRecorder<WeightedTraceStopReason>();
  const distances = new Map<AssetId, number>();
  const hops = new Map<AssetId, number>();
  const done = new Set<AssetId>();
  const crossedLinks = new Set<AssetId>();
  const resultNodes: AssetId[] = [];
  const resultLinks: AssetId[] = [];
  const heap = new MinHeap();

  const seed = (nodeId: AssetId) => {
    if (distances.has(nodeId)) return;
    distances.set(nodeId, 0);
    hops.set(nodeId, 0);
    heap.push(nodeId, 0);
  };

  for (const nodeId of start.nodeIds) seed(nodeId);

  for (const linkId of start.linkIds) {
    crossedLinks.add(linkId);
    resultLinks.push(linkId);

    const [startNode, endNode] = topology.getNodes(linkId);
    seed(startNode);
    seed(endNode);
  }

  while (!heap.isEmpty()) {
    const { id: nodeId } = heap.pop()!;
    if (done.has(nodeId)) continue;

    if (rules.isNodeBarrier(nodeId)) {
      distances.delete(nodeId);
      continue;
    }

    done.add(nodeId);
    resultNodes.push(nodeId);
    const distance = distances.get(nodeId)!;
    const hopCount = hops.get(nodeId)!;

    for (const linkId of topology.getLinks(nodeId)) {
      if (crossedLinks.has(linkId)) continue;

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

      const neighborId = rules.otherEnd(linkId, nodeId);
      if (!done.has(neighborId)) {
        if (rules.isNodeBarrier(neighborId)) {
          stops.record({
            assetId: neighborId,
            reason: "barrier",
            fromNodeId: nodeId,
            viaLinkId: linkId,
          });
        } else {
          const neighborDistance = distance + lengthOf(linkId);
          const neighborHops = hopCount + 1;
          if (neighborDistance > maxDistance || neighborHops > maxHops) {
            stops.record({
              assetId: neighborId,
              reason: "limit",
              fromNodeId: nodeId,
              viaLinkId: linkId,
            });
            continue;
          }
          const known = distances.get(neighborId);
          if (known === undefined || neighborDistance < known) {
            distances.set(neighborId, neighborDistance);
            hops.set(neighborId, neighborHops);
            heap.push(neighborId, neighborDistance);
          }
        }
      }

      crossedLinks.add(linkId);
      resultLinks.push(linkId);
    }
  }

  return {
    nodeIds: resultNodes,
    linkIds: resultLinks,
    stops: stops.notReached(
      (assetId) => done.has(assetId) || crossedLinks.has(assetId),
    ),
    distances: new Map(resultNodes.map((id) => [id, distances.get(id)!])),
  };
}
