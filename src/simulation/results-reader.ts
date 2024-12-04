export interface ResultsReader {
  getPressure: (nodeId: string) => number;
}
