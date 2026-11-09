import { AssetId } from "../asset-types";
import { TopologyQueries } from "../topology";
import { TraceBarriers, TraceStop } from "./types";

export const crossingRules = (
  topology: TopologyQueries,
  barriers: TraceBarriers,
) => {
  const otherEnd = (linkId: AssetId, nodeId: AssetId): AssetId => {
    const [startNode, endNode] = topology.getNodes(linkId);
    return startNode === nodeId ? endNode : startNode;
  };

  return {
    linkStopReason: (linkId: AssetId, fromNodeId: AssetId) =>
      barriers.linkStopReason(linkId, fromNodeId),
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
