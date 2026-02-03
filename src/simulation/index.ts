export { runSimulation } from "./epanet/main";
export type { SimulationProgress, ProgressCallback } from "./epanet/worker";
export { EPSResultsReader } from "./epanet/eps-results-reader";
export type { SimulationIds } from "./epanet/eps-results-reader";
export { SimulationMetadata } from "./epanet/simulation-metadata";
export type {
  PipeSimulation,
  ValveSimulation,
  PumpSimulation,
  JunctionSimulation,
  TankSimulation,
  ResultsReader,
  SimulationProperty,
} from "./results-reader";
export {
  isSimulationProperty,
  getSortedSimulationValues,
  simulationProperties,
} from "./results-reader";
