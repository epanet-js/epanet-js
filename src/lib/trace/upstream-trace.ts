import { TraceBuffers, TraceBuffersView } from "./trace-buffers";
import { EncodedTraceResult, FlowDirection } from "./types";

export interface UpstreamTraceStart {
  nodeIndices: number[];
  linkIndices: number[];
}

export function upstreamTrace(
  start: UpstreamTraceStart,
  buffers: TraceBuffers,
): EncodedTraceResult {
  const views = new TraceBuffersView(buffers);
  const flowDirections = views.flowDirections;
  if (!flowDirections) {
    return { nodeIndices: [], linkIndices: [] };
  }

  const visitedNodes = new Set<number>();
  const visitedLinks = new Set<number>();
  const resultNodes: number[] = [];
  const resultLinks: number[] = [];

  // Include any pre-selected links (when starting from a link click)
  for (const linkIdx of start.linkIndices) {
    visitedLinks.add(linkIdx);
    resultLinks.push(linkIdx);
  }

  const stack = [...start.nodeIndices];

  while (stack.length > 0) {
    const nodeIdx = stack.pop()!;

    if (visitedNodes.has(nodeIdx)) continue;
    visitedNodes.add(nodeIdx);
    resultNodes.push(nodeIdx);

    const connectedLinks = views.nodeConnections.getById(nodeIdx);
    for (const linkIdx of connectedLinks) {
      if (visitedLinks.has(linkIdx)) continue;

      const [startNode, endNode] = views.linkConnections.getById(linkIdx);
      const direction = flowDirections[linkIdx];

      // Determine if water ENTERS this node through this link.
      // POSITIVE = start→end. NEGATIVE = end→start.
      const waterEntersNode =
        (nodeIdx === endNode && direction === FlowDirection.POSITIVE) ||
        (nodeIdx === startNode && direction === FlowDirection.NEGATIVE);

      if (!waterEntersNode) continue;

      visitedLinks.add(linkIdx);
      resultLinks.push(linkIdx);

      // Follow upstream to the neighbor node where water comes from
      const neighborIdx = startNode === nodeIdx ? endNode : startNode;
      if (!visitedNodes.has(neighborIdx)) {
        stack.push(neighborIdx);
      }
    }
  }

  return { nodeIndices: resultNodes, linkIndices: resultLinks };
}
