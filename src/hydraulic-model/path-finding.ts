import { AssetId, AssetsMap } from "src/hydraulic-model";
import { Topology } from "./topology/topology";
import { PathData } from "src/state/profile-view";

export function findPaths(
  topology: Topology,
  assets: AssetsMap,
  startNodeId: AssetId,
  endNodeId: AssetId,
): PathData[] {
  if (startNodeId === endNodeId) return [];

  // Track the shortest known distance to each node
  const distances = new Map<AssetId, number>();
  // Track the previous node and the link used to get there to reconstruct the path
  const previous = new Map<AssetId, { nodeId: AssetId; linkId: AssetId }>();

  const pq = new MinHeap();

  distances.set(startNodeId, 0);
  pq.push(startNodeId, 0);

  while (!pq.isEmpty()) {
    const current = pq.pop();
    if (!current) break;

    const { id: currentNodeId, priority: currentDist } = current;

    // If we've reached the target, we can reconstruct the path and exit early
    if (currentNodeId === endNodeId) {
      return [reconstructPath(startNodeId, endNodeId, previous, currentDist)];
    }

    // If we found a shorter path to this node already, skip processing
    const knownDist = distances.get(currentNodeId) ?? Infinity;
    if (currentDist > knownDist) continue;

    const linkAssetIds = topology.getLinks(currentNodeId);

    for (const linkId of linkAssetIds) {
      const [n1, n2] = topology.getNodes(linkId);
      const nextNodeId = n1 === currentNodeId ? n2 : n1;

      const weight = getLinkLength(linkId, assets);
      const newDist = knownDist + weight;

      // If we found a shorter path to the neighbor, update it
      const neighborDist = distances.get(nextNodeId) ?? Infinity;
      if (newDist < neighborDist) {
        distances.set(nextNodeId, newDist);
        previous.set(nextNodeId, { nodeId: currentNodeId, linkId });
        pq.push(nextNodeId, newDist);
      }
    }
  }

  // If the queue empties and we never hit endNodeId, no path exists
  return [];
}

// --- Helper Functions ---

function getLinkLength(linkId: AssetId, assets: AssetsMap): number {
  const link = assets.get(linkId);
  if (link && link.isLink) {
    // Treat negative or missing lengths as 0 to prevent algorithm failure
    return Math.max(0, (link as { length: number }).length || 0);
  }
  return 0; // Default weight for non-physical/logical links
}

function reconstructPath(
  startNodeId: AssetId,
  endNodeId: AssetId,
  previous: Map<AssetId, { nodeId: AssetId; linkId: AssetId }>,
  totalLength: number,
): PathData {
  const nodeIds: AssetId[] = [];
  const linkIds: AssetId[] = [];

  let currId = endNodeId;

  while (currId !== startNodeId) {
    nodeIds.unshift(currId);
    const prevData = previous.get(currId);

    if (!prevData) {
      throw new Error("Path reconstruction failed: broken link sequence.");
    }

    linkIds.unshift(prevData.linkId);
    currId = prevData.nodeId;
  }

  // Finally, add the starting node to the beginning of the sequence
  nodeIds.unshift(startNodeId);

  return { nodeIds, linkIds, totalLength };
}

// --- Priority Queue (Min-Heap) Implementation ---
// Required for Dijkstra's algorithm to run in O(E log V) time.

class MinHeap {
  private heap: { id: AssetId; priority: number }[] = [];

  push(id: AssetId, priority: number) {
    this.heap.push({ id, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { id: AssetId; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return min;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  private bubbleUp(index: number) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (element.priority >= parent.priority) break;

      this.heap[index] = parent;
      this.heap[parentIndex] = element;
      index = parentIndex;
    }
  }

  private sinkDown(index: number) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIndex = 2 * index + 1;
      const rightChildIndex = 2 * index + 2;
      let leftChild, rightChild;
      let swap = null;

      if (leftChildIndex < length) {
        leftChild = this.heap[leftChildIndex];
        if (leftChild.priority < element.priority) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        rightChild = this.heap[rightChildIndex];
        if (
          (swap === null && rightChild.priority < element.priority) ||
          (swap !== null &&
            leftChild &&
            rightChild.priority < leftChild.priority)
        ) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      this.heap[swap] = element;
      index = swap;
    }
  }
}
