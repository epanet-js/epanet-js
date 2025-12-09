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
  buildNodeTypes,
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
  initOPFS,
  writeBinaryToOPFS,
  writeTankBinaryToOPFS,
  getOPFSFile,
  readBinarySlice,
  readTankBinarySlice,
  readTimestepCountFromOPFS,
  clearAllSimulationsFromOPFS,
  updateHeartbeat,
  cleanupStaleTabs,
} from "./eps-store";

export {
  calculateResultsBaseOffset,
  calculateTimestepBlockSize,
  extractTimestepFromSlice,
  parsePrologHeader,
  calculatePrologSize,
  PROLOG_HEADER_SIZE,
} from "./epanet-binary-reader";
