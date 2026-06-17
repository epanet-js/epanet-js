export type { HydraulicModel } from "./hydraulic-model";
export type { Projection } from "src/lib/projections";
export {
  initializeHydraulicModel,
  updateHydraulicModelAssets,
  copyModel,
} from "./hydraulic-model";
export type { RawControls } from "@epanet-js/hydraulic-model";
export { createEmptyRawControls } from "@epanet-js/hydraulic-model";
export { AssetFactory } from "@epanet-js/hydraulic-model";
export type {
  JunctionBuildData,
  PipeBuildData,
  ReservoirBuildData,
} from "@epanet-js/hydraulic-model";
export type { AssetId } from "@epanet-js/hydraulic-model";
export { filterAssets, getNode, AssetsMap } from "@epanet-js/hydraulic-model";
export type {
  ModelOperation,
  OptionalMomentFields,
  ModelMoment,
  ReverseMoment,
  AssetPatch,
} from "./model-operation";
export { BaseAsset } from "@epanet-js/hydraulic-model";
export type {
  AssetStatus,
  AssetPropertiesMap,
  PipeProperties,
  NodeAsset,
  LinkAsset,
  Asset,
  Reservoir,
  Junction,
  Pipe,
  Pump,
  Tank,
  Valve,
} from "@epanet-js/hydraulic-model";
export { calculateAverageHead } from "@epanet-js/hydraulic-model";
export type { DefaultsSpec } from "@epanet-js/hydraulic-model";
export { Topology } from "@epanet-js/hydraulic-model";

export type { HeadlossFormula } from "@epanet-js/hydraulic-model";
export { headlossFormulas } from "@epanet-js/hydraulic-model";
export type { LinkType, NodeType, AssetType } from "@epanet-js/hydraulic-model";
export type {
  PatternMultipliers,
  PatternId,
  PatternType,
  Pattern,
  Patterns,
} from "@epanet-js/hydraulic-model";
export {
  getNextPatternId,
  deepClonePatterns,
  differentPatternsCount,
} from "@epanet-js/hydraulic-model";
export type {
  Demands,
  Demand,
  PatternAverageCache,
} from "@epanet-js/hydraulic-model";
export {
  createEmptyDemands,
  getJunctionDemands,
  getCustomerPointDemands,
  calculateAverageDemand,
  averagePatternMultiplier as calculatePatternAverage,
  getTotalCustomerDemand,
} from "@epanet-js/hydraulic-model";
export { applyMomentToModel } from "./mutations/apply-moment";
