import {
  JunctionSimulation,
  PumpSimulation,
  ResultsReader,
  ValveSimulation,
} from "../results-reader";

export type NodeResults = Map<string, JunctionSimulation>;

type LinkResult = {
  type: "link";
  flow: number;
  velocity: number;
  headloss: number;
};

export type LinkResults = Map<
  string,
  LinkResult | ValveSimulation | PumpSimulation
>;

export class EpanetResults implements ResultsReader {
  private nodes: NodeResults;
  private links: LinkResults;

  constructor(nodes: NodeResults, links: LinkResults) {
    this.nodes = nodes;
    this.links = links;
  }

  getFlow(linkId: string) {
    return this.links.has(linkId) ? this.links.get(linkId)!.flow : null;
  }

  getVelocity(linkId: string) {
    return this.links.has(linkId)
      ? (this.links.get(linkId)! as LinkResult).velocity
      : null;
  }

  getHeadloss(linkId: string) {
    return this.links.has(linkId) ? this.links.get(linkId)!.headloss : null;
  }

  getValve(valveId: string): ValveSimulation | null {
    if (!this.links.has(valveId)) return null;

    return this.links.get(valveId) as ValveSimulation;
  }

  getPump(pumpId: string): PumpSimulation | null {
    if (!this.links.has(pumpId)) return null;

    return this.links.get(pumpId) as PumpSimulation;
  }

  getJunction(junctionId: string): JunctionSimulation | null {
    if (!this.nodes.has(junctionId)) return null;

    return this.nodes.get(junctionId) as JunctionSimulation;
  }
}
