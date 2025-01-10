import { ResultsReader } from "../results-reader";

export type NodeResults = Map<string, { pressure: number }>;

export type LinkResults = Map<string, { flow: number; velocity: number }>;

export class EpanetResults implements ResultsReader {
  private nodes: NodeResults;
  private links: LinkResults;

  constructor(nodes: NodeResults, links: LinkResults) {
    this.nodes = nodes;
    this.links = links;
  }

  getPressure(nodeId: string) {
    return this.nodes.has(nodeId) ? this.nodes.get(nodeId)!.pressure : null;
  }

  getFlow(linkId: string) {
    return this.links.has(linkId) ? this.links.get(linkId)!.flow : null;
  }

  getVelocity(linkId: string) {
    return this.links.has(linkId) ? this.links.get(linkId)!.velocity : null;
  }
}
