export type ValveSimulation = {
  type: "valve";
  flow: number;
  velocity: number;
  headloss: number;
  status: "active" | "open" | "closed";
};

export interface ResultsReader {
  getPressure: (nodeId: string) => number | null;
  getFlow: (linkId: string) => number | null;
  getVelocity: (linkId: string) => number | null;
  getHeadloss: (linkId: string) => number | null;
  getPumpStatus: (linkId: string) => "on" | "off" | null;
  getPumpStatusWarning: (
    linkId: string,
  ) => "cannot-deliver-flow" | "cannot-deliver-head" | null;
  getValveStatus: (linkId: string) => "open" | "closed" | "active" | null;
  getValve: (valveId: string) => ValveSimulation | null;
}
