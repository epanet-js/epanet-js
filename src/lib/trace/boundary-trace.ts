import { TraceBuffers, TraceBuffersView } from "./trace-buffers";
import { EncodedTraceResult, LinkTraversal, NodeTraversal } from "./types";

export interface BoundaryTraceStart {
  nodeIndices: number[];
  linkIndices: number[];
}

export function boundaryTrace(
  start: BoundaryTraceStart,
  buffers: TraceBuffers,
): EncodedTraceResult {
  const views = new TraceBuffersView(buffers);
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

    // Boundary nodes stop the trace and are excluded from the result
    const nodeTraversal = views.nodeTraversal.getById(nodeIdx);
    if (nodeTraversal === NodeTraversal.BOUNDARY) continue;

    visitedNodes.add(nodeIdx);
    resultNodes.push(nodeIdx);

    const connectedLinks = views.nodeConnections.getById(nodeIdx);
    for (const linkIdx of connectedLinks) {
      if (visitedLinks.has(linkIdx)) continue;

      const linkTraversalValue = views.linkTraversal.getById(linkIdx);

      // Boundary links stop the trace and are excluded from the result
      if (linkTraversalValue === LinkTraversal.BOUNDARY) continue;

      // One-way (CV pipe): can only traverse from start node to end node
      if (linkTraversalValue === LinkTraversal.ONE_WAY) {
        const [startNode] = views.linkConnections.getById(linkIdx);
        if (nodeIdx !== startNode) continue;
      }

      visitedLinks.add(linkIdx);
      resultLinks.push(linkIdx);

      const [startNode, endNode] = views.linkConnections.getById(linkIdx);
      const neighborIdx = startNode === nodeIdx ? endNode : startNode;

      if (!visitedNodes.has(neighborIdx)) {
        stack.push(neighborIdx);
      }
    }
  }

  return { nodeIndices: resultNodes, linkIndices: resultLinks };
}
