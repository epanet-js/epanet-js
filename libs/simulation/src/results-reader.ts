export type PipeSimulation = {
  type: "pipe";
  flow: number;
  velocity: number;
  headloss: number;
  unitHeadloss: number;
  status: "open" | "closed";
  waterAge: number | null;
  waterTrace: number | null;
  chemicalConcentration: number | null;
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
  chemicalConcentration: number | null;
};

export type PumpSimulation = {
  type: "pump";
  flow: number;
  head: number;
  status: "on" | "off";
  statusWarning: "cannot-deliver-flow" | "cannot-deliver-head" | null;
  waterAge: number | null;
  waterTrace: number | null;
  chemicalConcentration: number | null;
};

export type JunctionSimulation = {
  type: "junction";
  pressure: number;
  head: number;
  demand: number;
  minPressure: number;
  maxPressure: number;
  waterAge: number | null;
  waterTrace: number | null;
  chemicalConcentration: number | null;
};

export type TankSimulation = {
  type: "tank";
  pressure: number;
  head: number;
  netFlow: number;
  level: number;
  volume: number;
  minPressure: number;
  maxPressure: number;
  waterAge: number | null;
  waterTrace: number | null;
  chemicalConcentration: number | null;
};

export type ReservoirSimulation = {
  type: "reservoir";
  pressure: number;
  head: number;
  netFlow: number;
  minPressure: number;
  maxPressure: number;
  waterAge: number | null;
  waterTrace: number | null;
  chemicalConcentration: number | null;
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

export const pipeStatusOf = (code: number): PipeSimulation["status"] =>
  code < 3 ? "closed" : "open";

export const valveStatusOf = (code: number): ValveSimulation["status"] => {
  if (code < 3) return "closed";
  if (code === 4) return "active";
  return "open";
};

export const valveStatusWarningOf = (
  code: number,
): ValveSimulation["statusWarning"] => {
  if (code === 6) return "cannot-deliver-flow";
  if (code === 7) return "cannot-deliver-pressure";
  return null;
};

export const pumpStatusOf = (code: number): PumpSimulation["status"] =>
  code >= 3 ? "on" : "off";

export const pumpStatusWarningOf = (
  code: number,
): PumpSimulation["statusWarning"] => {
  if (code === 0) return "cannot-deliver-head";
  if (code === 5) return "cannot-deliver-flow";
  return null;
};

export const simulationProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "pressure",
  "minPressure",
  "maxPressure",
  "actualDemand",
  "head",
  "waterAge",
  "waterTrace",
  "chemicalConcentration",
] as const;

export type SimulationProperty = (typeof simulationProperties)[number];

export const isSimulationProperty = (
  property: string,
): property is SimulationProperty => {
  return simulationProperties.includes(property as SimulationProperty);
};

export interface ResultsReader {
  getValve: (valveId: number) => ValveSimulation | null;
  getPump: (pumpId: number) => PumpSimulation | null;
  getJunction: (junctionId: number) => JunctionSimulation | null;
  getPipe: (pipeId: number) => PipeSimulation | null;
  getTank: (tankId: number) => TankSimulation | null;
  getReservoir: (reservoirId: number) => ReservoirSimulation | null;
  getPumpEnergy: (pumpId: number) => PumpEnergySummary | null;
  getLinkSetting: (linkId: number) => number | null;

  getAllValues: (property: SimulationProperty) => number[];
}
