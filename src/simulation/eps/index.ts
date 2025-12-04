// EPS (Extended Period Simulation) utilities

export {
  EpanetBinaryReader,
  parseProlog,
  extractNodeIds,
  extractLinkIds,
  extractTimestepResults,
  type EpanetProlog,
  type NodeTimestepResult,
  type LinkTimestepResult,
  type TimestepResults,
} from "./epanet-binary-reader";

export {
  saveEPSSimulation,
  loadEPSSimulation,
  deleteEPSSimulation,
  listEPSSimulations,
  clearAllEPSSimulations,
  type EPSSimulationMetadata,
  type EPSSimulationRecord,
} from "./eps-store";

export {
  runEPSSimulation,
  type EPSSimulationResult,
} from "./run-eps-simulation";
