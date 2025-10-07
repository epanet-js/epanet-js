import { HydraulicModelBufferView, EncodedOrphanAssets, RunData } from "./data";

export function findOrphanAssets(input: RunData): EncodedOrphanAssets {
  const data = new HydraulicModelBufferView(
    input.nodeBuffer,
    input.pipeBuffer,
    input.otherLinkBuffer,
  );

  const connected = new Set<number>();

  for (const pipe of data.pipes()) {
    connected.add(pipe.startNode);
    connected.add(pipe.endNode);
  }

  const orphanLinks: number[] = [];
  for (const link of data.otherLinks()) {
    if (!connected.has(link.startNode) && !connected.has(link.endNode)) {
      orphanLinks.push(link.id);
    }
    // Mark nodes as connected to avoid duplicate reporting
    connected.add(link.startNode);
    connected.add(link.endNode);
  }

  const orphanNodes: number[] = [];
  for (const node of data.nodes()) {
    if (!connected.has(node.id)) {
      orphanNodes.push(node.id);
    }
  }

  return { orphanNodes, orphanLinks };
}
