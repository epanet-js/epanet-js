export type PipeSimulation = {
  type: "pipe";
  flow: number;
  velocity: number;
  headloss: number;
  unitHeadloss: number;
  status: "open" | "closed";
  waterAge: number | null;
  waterTrace: number | null;
};

export type ValveSimulation = {
  type: "valve";
  flow: number;
  velocity: number;
  headloss: number;
  status: "active" | "open" | "closed";
  statusWarning: "cannot-deliver-flow" | "cannot-deliver-pressure" | null;
  waterAge: number | null;
  waterTrace: number | null;
};

export type PumpSimulation = {
  type: "pump";
  flow: number;
  headloss: number;
  status: "on" | "off";
  statusWarning: "cannot-deliver-flow" | "cannot-deliver-head" | null;
  waterAge: number | null;
  waterTrace: number | null;
};

export type JunctionSimulation = {
  type: "junction";
  pressure: number;
  head: number;
  demand: number;
  waterAge: number | null;
  waterTrace: number | null;
};

export type TankSimulation = {
  type: "tank";
  pressure: number;
  head: number;
  netFlow: number;
  level: number;
  volume: number;
  waterAge: number | null;
  waterTrace: number | null;
};

export type ReservoirSimulation = {
  type: "reservoir";
  pressure: number;
  head: number;
  netFlow: number;
  waterAge: number | null;
  waterTrace: number | null;
};

export type PumpEnergySummary = {
  utilization: number;
  averageEfficiency: number;
  averageKwPerFlowUnit: number;
  averageKw: number;
  peakKw: number;
  averageCostPerDay: number;
  demandCharge: number;
};

export interface ResultsReader {
  getValve: (valveId: number) => ValveSimulation | null;
  getPump: (pumpId: number) => PumpSimulation | null;
  getJunction: (junctionId: number) => JunctionSimulation | null;
  getPipe: (pipeId: number) => PipeSimulation | null;
  getTank: (tankId: number) => TankSimulation | null;
  getReservoir: (reservoirId: number) => ReservoirSimulation | null;
  getPumpEnergy: (pumpId: number) => PumpEnergySummary | null;

  getAllPressures: () => number[];
  getAllHeads: () => number[];
  getAllDemands: () => number[];
  getAllFlows: () => number[];
  getAllVelocities: () => number[];
  getAllUnitHeadlosses: () => number[];
  getAllWaterAges: () => number[];
  getAllWaterTraces: () => number[];
}
