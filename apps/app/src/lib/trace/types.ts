import { AssetId } from "@epanet-js/hydraulic-model";

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
