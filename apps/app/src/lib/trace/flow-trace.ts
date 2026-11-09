import {
  AllowedFlowDirection,
  anyBarrier,
  AssetId,
  respectingFlowDirection,
  TopologyQueries,
  trace,
  type AllowedFlowDirectionQueries,
  type AllowedFlowDirectionValue,
  type TraceResult,
  type TraceStart,
} from "@epanet-js/hydraulic-model";
import {
  FlowDirection,
  FlowDirectionQueries,
  FlowDirectionValue,
} from "./types";

const crossings = (
  status: FlowDirectionQueries,
  crossingOf: Record<FlowDirectionValue, AllowedFlowDirectionValue>,
): AllowedFlowDirectionQueries => ({
  getAllowedFlowDirection: (linkId) =>
    crossingOf[status.getFlowDirection(linkId)],
});

const alongFlow = {
  [FlowDirection.NONE]: AllowedFlowDirection.NONE,
  [FlowDirection.DOWNSTREAM]: AllowedFlowDirection.DOWNSTREAM,
  [FlowDirection.UPSTREAM]: AllowedFlowDirection.UPSTREAM,
};

const againstFlow = {
  [FlowDirection.NONE]: AllowedFlowDirection.NONE,
  [FlowDirection.DOWNSTREAM]: AllowedFlowDirection.UPSTREAM,
  [FlowDirection.UPSTREAM]: AllowedFlowDirection.DOWNSTREAM,
};

const flowTrace = (
  start: TraceStart,
  topology: TopologyQueries,
  directions: AllowedFlowDirectionQueries,
): TraceResult => {
  const farEndOf = (linkId: AssetId): AssetId[] => {
    const [startNode, endNode] = topology.getNodes(linkId);
    switch (directions.getAllowedFlowDirection(linkId)) {
      case AllowedFlowDirection.DOWNSTREAM:
        return [endNode];
      case AllowedFlowDirection.UPSTREAM:
        return [startNode];
      default:
        return [];
    }
  };

  const { nodeIds, linkIds } = trace(
    {
      nodeIds: [...start.nodeIds, ...start.linkIds.flatMap(farEndOf)],
      linkIds: [],
    },
    topology,
    respectingFlowDirection(anyBarrier(), topology, directions),
  );

  return { nodeIds, linkIds: [...new Set([...start.linkIds, ...linkIds])] };
};

export const upstreamTrace = (
  start: TraceStart,
  topology: TopologyQueries,
  status: FlowDirectionQueries,
): TraceResult => flowTrace(start, topology, crossings(status, againstFlow));

export const downstreamTrace = (
  start: TraceStart,
  topology: TopologyQueries,
  status: FlowDirectionQueries,
): TraceResult => flowTrace(start, topology, crossings(status, alongFlow));
