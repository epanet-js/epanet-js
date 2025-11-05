import { EventedType } from "ngraph.events";
import createGraph, { Graph, Link, Node } from "ngraph.graph";
import { AssetId, NO_ASSET_ID } from "../asset-types/base-asset";
import { TopologyQueries } from "./types";

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
}
