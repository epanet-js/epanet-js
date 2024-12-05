export interface ResultsReader {
  getPressure: (nodeId: string) => number;
  getFlow: (linkId: string) => number;
}
