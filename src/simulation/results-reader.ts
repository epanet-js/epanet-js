export type PipeSimulation = {
  type: "pipe";
  flow: number;
  velocity: number;
  headloss: number;
  unitHeadloss: number;
  status: "open" | "closed";
};

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
  head: number;
  demand: number;
};

export type TankSimulation = {
  type: "tank";
  pressure: number;
  head: number;
  level: number;
  volume: number;
};

export interface ResultsReader {
  getValve: (valveId: string) => ValveSimulation | null;
  getPump: (pumpId: string) => PumpSimulation | null;
  getJunction: (junctionId: string) => JunctionSimulation | null;
  getPipe: (pipeId: string) => PipeSimulation | null;
  getTank: (tankId: string) => TankSimulation | null;
}
