export type ValveSimulation = {
  type: "valve";
  flow: number;
  velocity: number;
  headloss: number;
  status: "active" | "open" | "closed";
  statusWarning: "cannot-deliver-flow" | "cannot-deliver-pressure" | null;
};

export type PumpSimulation = {
  type: "pump";
  flow: number;
  headloss: number;
  status: "on" | "off";
  statusWarning: "cannot-deliver-flow" | "cannot-deliver-head" | null;
};

export type JunctionSimulation = {
  type: "junction";
  pressure: number;
};

export interface ResultsReader {
  getFlow: (linkId: string) => number | null;
  getVelocity: (linkId: string) => number | null;
  getHeadloss: (linkId: string) => number | null;
  getValve: (valveId: string) => ValveSimulation | null;
  getPump: (pumpId: string) => PumpSimulation | null;
  getJunction: (junctionId: string) => JunctionSimulation | null;
}
