import { AssetId } from "../asset-types";

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
