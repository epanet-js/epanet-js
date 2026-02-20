export type TraceMode = "boundary" | "upstream" | "downstream";

export const FLOW_TOLERANCE = 0.001;

/**
 * Per-link traversal classification (pre-computed during encoding).
 * Used by boundary trace to determine stop conditions.
 */
export const LinkTraversal = {
  /** Open pipe, open TCV — freely traversable */
  FREE: 0,
  /** Pump, closed pipe, non-TCV valve, closed TCV — stops trace */
  BOUNDARY: 1,
  /** CV pipe — can only traverse from start node to end node */
  ONE_WAY: 2,
} as const;

export type LinkTraversalValue =
  (typeof LinkTraversal)[keyof typeof LinkTraversal];

/**
 * Per-node traversal classification (pre-computed during encoding).
 * Used by boundary trace to determine stop conditions.
 */
export const NodeTraversal = {
  /** Junction — freely traversable */
  FREE: 0,
  /** Tank or Reservoir — stops trace */
  BOUNDARY: 1,
} as const;

export type NodeTraversalValue =
  (typeof NodeTraversal)[keyof typeof NodeTraversal];

/**
 * Per-link flow direction (pre-computed during encoding).
 * Encodes only the direction of flow relative to link coordinate order.
 *
 * - Positive flow goes from start node to end node (same as coordinate order)
 * - Negative flow goes from end node to start node (against coordinate order)
 * - None means flow is below tolerance (effectively zero)
 */
export const FlowDirection = {
  NONE: 0,
  POSITIVE: 1,
  NEGATIVE: 2,
} as const;

export type FlowDirectionValue =
  (typeof FlowDirection)[keyof typeof FlowDirection];

export type EncodedTraceResult = {
  nodeIndices: number[];
  linkIndices: number[];
};
