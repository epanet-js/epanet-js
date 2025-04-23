import { ResultsReader, ValveSimulation } from "../results-reader";

export type NodeResults = Map<string, { pressure: number }>;

type LinkResult = {
  type: "link";
  flow: number;
  velocity: number;
  headloss: number;
  pumpState: number;
};

export type LinkResults = Map<string, LinkResult | ValveSimulation>;

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

    const results = this.links.get(linkId) as LinkResult;
    const epanetStatus = results.pumpState;
    if (epanetStatus === undefined) return null;

    return epanetStatus < 3 ? "off" : "on";
  }

  getValve(valveId: string): ValveSimulation | null {
    if (!this.links.has(valveId)) return null;

    return this.links.get(valveId) as ValveSimulation;
  }

  getValveStatus(linkId: string) {
    if (!this.links.has(linkId)) return null;

    const results = this.links.get(linkId) as ValveSimulation;
    return results.status;
  }

  getPumpStatusWarning(linkId: string) {
    if (!this.links.has(linkId)) return null;

    const results = this.links.get(linkId) as LinkResult;
    const epanetStatus = results.pumpState;
    if (epanetStatus === undefined) return null;
    if (epanetStatus === 5) return "cannot-deliver-flow";
    if (epanetStatus === 0) return "cannot-deliver-head";

    return null;
  }
}
