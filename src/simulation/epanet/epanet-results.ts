import { ResultsReader } from "../results-reader";

export type NodeResults = Map<string, { pressure: number }>;

export type LinkResults = Map<
  string,
  {
    flow: number;
    velocity: number;
    headloss: number;
    pumpState: number;
  }
>;

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

  getHeadloss(linkId: string) {
    return this.links.has(linkId) ? this.links.get(linkId)!.headloss : null;
  }

  getPumpStatus(linkId: string) {
    if (!this.links.has(linkId)) return null;

    const epanetStatus = this.links.get(linkId)?.pumpState;
    if (epanetStatus === undefined) return null;

    return epanetStatus < 3 ? "off" : "on";
  }

  getPumpStatusWarning(linkId: string) {
    if (!this.links.has(linkId)) return null;

    const epanetStatus = this.links.get(linkId)?.pumpState;
    if (epanetStatus === undefined) return null;
    if (epanetStatus === 5) return "cannot-supply-flow";
    if (epanetStatus === 0) return "cannot-deliver-head";

    return null;
  }
}
