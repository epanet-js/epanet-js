import { EventedType } from "ngraph.events";
import createGraph, { Graph, Link, Node } from "ngraph.graph";

type GraphChange = {
  changeType: "add" | "remove";
  link?: Link;
  node?: Node;
};

export class Topology {
  private graph: Graph<string> & EventedType;
  private linksMap: Map<string, Link>;

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

  hasLink(linkId: string) {
    return this.linksMap.has(linkId);
  }

  addLink(linkId: string, startNodeId: string, endNodeId: string) {
    if (this.linksMap.has(linkId)) {
      return;
    }

    try {
      const link = this.graph.addLink(startNodeId, endNodeId, { id: linkId });
      this.linksMap.set(linkId, link);
    } catch (error) {
      throw new Error(
        `Failed to add link (${linkId}, ${startNodeId}, ${endNodeId}): ${(error as Error).message}`,
      );
    }
  }

  getLinks(nodeId: string): string[] {
    const links = this.graph.getLinks(nodeId);
    return Array.from(links || []).map((link: Link) => link.data.id as string);
  }

  removeNode(nodeId: string) {
    this.graph.removeNode(nodeId);
  }

  removeLink(linkId: string) {
    const link = this.linksMap.get(linkId);

    if (!link) return;

    this.graph.removeLink(link);
  }
}
