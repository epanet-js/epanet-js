import { EventedType } from "ngraph.events";
import createGraph, { Graph, Link, Node } from "ngraph.graph";
import { AssetId, NO_ASSET_ID } from "../asset-types/base-asset";
import { BoundaryLinkData, PathData, TopologyQueries } from "./types";
import { MinHeap } from "../min-heap";

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

  boundaryLinks(nodeIds: Iterable<AssetId>): BoundaryLinkData[] {
    const inside = new Set(nodeIds);
    const seen = new Set<AssetId>();
    const boundary: BoundaryLinkData[] = [];
    for (const nodeId of inside) {
      for (const linkId of this.getLinks(nodeId)) {
        if (seen.has(linkId)) continue;
        seen.add(linkId);
        const [startNodeId, endNodeId] = this.getNodes(linkId);
        if (inside.has(startNodeId) === inside.has(endNodeId)) continue;
        boundary.push(
          inside.has(startNodeId)
            ? { linkId, insideNodeId: startNodeId, outsideNodeId: endNodeId }
            : { linkId, insideNodeId: endNodeId, outsideNodeId: startNodeId },
        );
      }
    }
    return boundary;
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
