import { ResultsReader } from "../results-reader";

export type NodeResults = {
  [id: string]: { pressure: number };
};

export class EpanetResults implements ResultsReader {
  private nodes: NodeResults;

  constructor(nodes: NodeResults) {
    this.nodes = nodes;
  }

  getPressure(nodeId: string) {
    return this.nodes[nodeId].pressure;
  }
}
