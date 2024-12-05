import { ResultsReader } from "../results-reader";

export type NodeResults = {
  [id: string]: { pressure: number };
};

export type LinkResults = {
  [id: string]: { flow: number };
};

export class EpanetResults implements ResultsReader {
  private nodes: NodeResults;
  private links: LinkResults;

  constructor(nodes: NodeResults, links: LinkResults) {
    this.nodes = nodes;
    this.links = links;
  }

  getPressure(nodeId: string) {
    return this.nodes[nodeId].pressure;
  }

  getFlow(linkId: string) {
    return this.links[linkId].flow;
  }
}
