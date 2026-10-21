import { AssetId } from "../asset-types";
import { TopologyQueries } from "../topology";
import {
  AllowedFlowDirection,
  AllowedFlowDirectionQueries,
  TraceBarriers,
  TraceStop,
  TraceStopReason,
} from "./types";

export const crossingRules = (
  topology: TopologyQueries,
  status: AllowedFlowDirectionQueries,
  barriers: TraceBarriers,
) => {
  const linkStopReason = (
    linkId: AssetId,
    fromNodeId: AssetId,
  ): TraceStopReason | null => {
    const direction = status.getAllowedFlowDirection(linkId);
    if (direction === AllowedFlowDirection.NONE) return "closed";
    if (barriers.isLinkBarrier(linkId)) return "barrier";

    // DOWNSTREAM (CV pipe): can only traverse from start node
    if (direction === AllowedFlowDirection.DOWNSTREAM) {
      const [startNode] = topology.getNodes(linkId);
      if (fromNodeId !== startNode) return "direction";
    }
    return null;
  };

  const otherEnd = (linkId: AssetId, nodeId: AssetId): AssetId => {
    const [startNode, endNode] = topology.getNodes(linkId);
    return startNode === nodeId ? endNode : startNode;
  };

  return {
    linkStopReason,
    isNodeBarrier: (nodeId: AssetId) => barriers.isNodeBarrier(nodeId),
    otherEnd,
  };
};

export const stopRecorder = <Reason extends string>() => {
  const stops = new Map<AssetId, TraceStop<Reason>>();
  return {
    record: (stop: TraceStop<Reason>) => {
      if (!stops.has(stop.assetId)) stops.set(stop.assetId, stop);
    },
    notReached: (isReached: (assetId: AssetId) => boolean) =>
      [...stops.values()].filter(({ assetId }) => !isReached(assetId)),
  };
};
