import { EventedType } from "ngraph.events";
import createGraph, { Graph, Link, Node } from "ngraph.graph";
import { AssetId, NO_ASSET_ID } from "../asset-types/base-asset";
import { PathData, TopologyQueries } from "./types";

type GraphChange = {
  changeType: "add" | "remove";
  link?: Link<LinkData>;
  node?: Node;
};
type LinkData = { id: AssetId };

export class Topology implements TopologyQueries {
  private graph: Graph<null, LinkData> & EventedType;
  private linksMap: Map<AssetId, Link<LinkData>>;

  constructor() {
    this.graph = createGraph({ multigraph: true });
    this.linksMap = new Map();

    this.graph.on("changed", (changes: GraphChange[]) => {
      changes.forEach((change: GraphChange) => {
        if (change.changeType === "remove" && change.link) {
          this.linksMap.delete(change.link.data.id);
        }
      });
    });
  }

  hasLink(linkId: AssetId) {
    return this.linksMap.has(linkId);
  }

  hasNode(nodeId: AssetId) {
    const node = this.graph.hasNode(nodeId);
    return node !== undefined;
  }

  getLinks(nodeId: AssetId): AssetId[] {
    const links = this.graph.getLinks(nodeId);
    return Array.from(links || []).map((link: Link<LinkData>) => link.data.id);
  }

  getNodes(linkId: AssetId): [AssetId, AssetId] {
    const link = this.linksMap.get(linkId);
    if (!link) return [NO_ASSET_ID, NO_ASSET_ID];
    return [link.fromId as number, link.toId as number];
  }

  addLink(linkId: AssetId, startNodeId: AssetId, endNodeId: AssetId) {
    if (this.linksMap.has(linkId)) {
      return;
    }

    try {
      const link = this.graph.addLink(startNodeId, endNodeId, {
        id: linkId,
      });
      this.linksMap.set(linkId, link);
    } catch (error) {
      throw new Error(
        `Failed to add link (${linkId}, ${startNodeId}, ${endNodeId}): ${(error as Error).message}`,
      );
    }
  }

  removeNode(nodeId: AssetId) {
    this.graph.removeNode(nodeId);
  }

  removeLink(linkId: AssetId) {
    const link = this.linksMap.get(linkId);

    if (!link) return;

    this.graph.removeLink(link);
  }

  copy(): Topology {
    const copy = new Topology();
    for (const [linkId, link] of this.linksMap) {
      copy.addLink(linkId, link.fromId as AssetId, link.toId as AssetId);
    }
    return copy;
  }

  shortestPath(
    startNodeId: AssetId,
    endNodeId: AssetId,
    weightOf: (linkId: AssetId) => number,
  ): PathData | null {
    if (startNodeId === endNodeId) return null;

    const distances = new Map<AssetId, number>();
    const previous = new Map<AssetId, { nodeId: AssetId; linkId: AssetId }>();
    const pq = new MinHeap();

    distances.set(startNodeId, 0);
    pq.push(startNodeId, 0);

    while (!pq.isEmpty()) {
      const current = pq.pop();
      if (!current) break;

      const { id: currentNodeId, priority: currentDist } = current;

      if (currentNodeId === endNodeId) {
        return reconstructPath(startNodeId, endNodeId, previous, currentDist);
      }

      const knownDist = distances.get(currentNodeId) ?? Infinity;
      if (currentDist > knownDist) continue;

      for (const linkId of this.getLinks(currentNodeId)) {
        const [n1, n2] = this.getNodes(linkId);
        const nextNodeId = n1 === currentNodeId ? n2 : n1;

        const newDist = knownDist + weightOf(linkId);

        const neighborDist = distances.get(nextNodeId) ?? Infinity;
        if (newDist < neighborDist) {
          distances.set(nextNodeId, newDist);
          previous.set(nextNodeId, { nodeId: currentNodeId, linkId });
          pq.push(nextNodeId, newDist);
        }
      }
    }

    return null;
  }
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

  nodeIds.unshift(startNodeId);

  return { nodeIds, linkIds, totalLength };
}

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
