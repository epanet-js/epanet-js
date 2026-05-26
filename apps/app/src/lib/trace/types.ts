import { AssetId } from "src/hydraulic-model/asset-types";

export type TraceMode = "boundary" | "upstream" | "downstream";

export const FLOW_TOLERANCE = 0.001;

/**
 * Per-link flow direction relative to link coordinate order.
 *
 * - NONE: no flow
 * - DOWNSTREAM: flow from start node to end node
 * - UPSTREAM: flow from end node to start node
 */
export const FlowDirection = {
  NONE: 0,
  DOWNSTREAM: 1,
  UPSTREAM: 2,
} as const;

export type FlowDirectionValue =
  (typeof FlowDirection)[keyof typeof FlowDirection];

export interface FlowDirectionQueries {
  getFlowDirection(linkId: AssetId): FlowDirectionValue;
}

/**
 * Per-link allowed flow direction.
 *
 * - NONE: no flow (closed assets, zero flow)
 * - BOTH: bidirectional (open pipes, open TCV valves)
 * - DOWNSTREAM: start → end only (CV pipes, active pumps, active non-TCV valves)
 */
export const AllowedFlowDirection = {
  NONE: 0,
  BOTH: 1,
  DOWNSTREAM: 2,
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
