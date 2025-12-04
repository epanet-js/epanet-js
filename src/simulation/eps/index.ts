// EPS (Extended Period Simulation) utilities

export {
  EpanetBinaryReader,
  parseProlog,
  extractNodeIds,
  extractLinkIds,
  extractLinkTypes,
  extractTankIndices,
  extractTankAreas,
  extractTimestepResults,
  BinaryLinkType,
  BinaryNodeType,
  type EpanetProlog,
  type NodeTimestepResult,
  type LinkTimestepResult,
  type TimestepResults,
} from "./epanet-binary-reader";

export {
  convertTimestepToSimulationResults,
  binaryToSimulationResults,
} from "./convert-binary-results";

export {
  saveEPSSimulation,
  loadEPSSimulation,
  deleteEPSSimulation,
  listEPSSimulations,
  clearAllEPSSimulations,
  findSimulationByModelVersion,
  type EPSSimulationMetadata,
  type EPSSimulationRecord,
  type TankTimestepData,
} from "./eps-store";
