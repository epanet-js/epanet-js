export interface ResultsReader {
  getPressure: (nodeId: string) => number | null;
  getFlow: (linkId: string) => number | null;
  getVelocity: (linkId: string) => number | null;
  getHeadloss: (linkId: string) => number | null;
  getPumpStatus: (linkId: string) => "on" | "off" | null;
  getPumpStatusWarning: (
    linkId: string,
  ) => "cannot-supply-flow" | "cannot-deliver-head" | null;
}
