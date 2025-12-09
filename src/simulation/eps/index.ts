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
  convertTimestepSliceToSimulationResults,
  type PartialReadMetadata,
} from "./convert-binary-results";

export {
  saveEPSSimulation,
  loadEPSSimulation,
  deleteEPSSimulation,
  listEPSSimulations,
  clearAllEPSSimulations,
  getOPFSFile,
  readBinarySlice,
  type EPSSimulationMetadata,
  type EPSSimulationRecord,
  type TankTimestepData,
} from "./eps-store";

export {
  calculateResultsBaseOffset,
  calculateTimestepBlockSize,
  extractTimestepFromSlice,
  parsePrologHeader,
  calculatePrologSize,
  PROLOG_HEADER_SIZE,
} from "./epanet-binary-reader";
