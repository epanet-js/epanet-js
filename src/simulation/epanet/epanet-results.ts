import {
  JunctionSimulation,
  PipeSimulation,
  PumpSimulation,
  ResultsReader,
  ValveSimulation,
} from "../results-reader";

export type NodeResults = Map<string, JunctionSimulation>;

export type LinkResults = Map<
  string,
  PipeSimulation | ValveSimulation | PumpSimulation
>;

export class EpanetResults implements ResultsReader {
  private nodes: NodeResults;
  private links: LinkResults;

  constructor(nodes: NodeResults, links: LinkResults) {
    this.nodes = nodes;
    this.links = links;
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

  getPipe(pipeId: string): PipeSimulation | null {
    if (!this.links.has(pipeId)) return null;

    return this.links.get(pipeId) as PipeSimulation;
  }
}
