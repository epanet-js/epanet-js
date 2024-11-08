import createGraph, { Graph } from "ngraph.graph";

export class Topology {
  private graph: Graph<string>;
  constructor() {
    this.graph = createGraph({ multigraph: true });
  }

  addLink(linkId: string, startNodeId: string, endNodeId: string) {
    this.graph.addLink(startNodeId, endNodeId, { id: linkId });
  }

  getLinks(nodeId: string): string[] {
    const links = this.graph.getLinks(nodeId);
    return Array.from(links || []).map((link) => link.data.id);
  }

  removeNode(nodeId: string) {
    this.graph.removeNode(nodeId);
  }
}
