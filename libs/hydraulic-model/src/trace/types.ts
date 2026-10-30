import { AssetId } from "../asset-types";

/**
 * Per-link allowed flow direction.
 *
 * - NONE: no flow (closed assets, zero flow)
 * - BOTH: bidirectional (open pipes, open TCV valves)
 * - DOWNSTREAM: start → end only (CV pipes, active pumps, active non-TCV valves)
 * - UPSTREAM: end → start only (simulated flow against the link's direction)
 */
export const AllowedFlowDirection = {
  NONE: 0,
  BOTH: 1,
  DOWNSTREAM: 2,
  UPSTREAM: 3,
} as const;

export type AllowedFlowDirectionValue =
  (typeof AllowedFlowDirection)[keyof typeof AllowedFlowDirection];

export interface AllowedFlowDirectionQueries {
  getAllowedFlowDirection(linkId: AssetId): AllowedFlowDirectionValue;
}

export type TraceStart = {
  nodeIds: AssetId[];
  linkIds: AssetId[];
};

export type TraceResult = {
  nodeIds: AssetId[];
  linkIds: AssetId[];
};

export interface TraceBarriers {
  isNodeBarrier(nodeId: AssetId): boolean;
  isLinkBarrier(linkId: AssetId): boolean;
}

export type TraceStopReason = "barrier" | "closed" | "direction";

export type WeightedTraceStopReason = TraceStopReason | "limit";

export type TraceStop<Reason extends string = TraceStopReason> = {
  assetId: AssetId;
  reason: Reason;
  fromNodeId: AssetId;
  viaLinkId: AssetId | null;
};

export type BarrierTraceResult = TraceResult & { stops: TraceStop[] };

export type TraceLimits = {
  maxDistance: number;
  maxHops: number;
  lengthOf: (linkId: AssetId) => number;
};

export type WeightedTraceResult = TraceResult & {
  stops: TraceStop<WeightedTraceStopReason>[];
  distances: Map<AssetId, number>;
};
