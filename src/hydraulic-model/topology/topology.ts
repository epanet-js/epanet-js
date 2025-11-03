import { EventedType } from "ngraph.events";
import createGraph, { Graph, Link, Node } from "ngraph.graph";
import { AssetId } from "../asset-types/base-asset";

type GraphChange = {
  changeType: "add" | "remove";
  link?: Link<LinkData>;
  node?: Node;
};
type LinkData = { id: AssetId };

export class Topology {
  private graph: Graph<null, LinkData> & EventedType;
  private linksMap: Map<AssetId, Link>;

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

  addLink(linkId: AssetId, startNodeId: AssetId, endNodeId: AssetId) {
    if (this.linksMap.has(linkId)) {
      return;
    }

    try {
      const link = this.graph.addLink(String(startNodeId), String(endNodeId), {
        id: linkId,
      });
      this.linksMap.set(linkId, link);
    } catch (error) {
      throw new Error(
        `Failed to add link (${linkId}, ${startNodeId}, ${endNodeId}): ${(error as Error).message}`,
      );
    }
  }

  getLinks(nodeId: AssetId): AssetId[] {
    const links = this.graph.getLinks(String(nodeId));
    return Array.from(links || []).map((link: Link<LinkData>) => link.data.id);
  }

  removeNode(nodeId: AssetId) {
    this.graph.removeNode(String(nodeId));
  }

  removeLink(linkId: AssetId) {
    const link = this.linksMap.get(linkId);

    if (!link) return;

    this.graph.removeLink(link);
  }
}
