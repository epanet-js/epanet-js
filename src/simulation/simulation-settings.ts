import { nanoid } from "nanoid";

export type DemandModel = "DDA" | "PDA";
export type UnbalancedMode = "STOP" | "CONTINUE";
export type QualitySimulationType = "NONE" | "CHEMICAL" | "AGE" | "TRACE";
export type QualityMassUnit = "mg/L" | "ug/L";

export type Timing = {
  duration: number;
  hydraulicTimestep: number;
  reportTimestep: number;
  patternTimestep: number;
  qualityTimestep?: number;
  ruleTimestep?: number;
};

export const defaultTiming: Timing = {
  duration: 0,
  hydraulicTimestep: 3600,
  reportTimestep: 3600,
  patternTimestep: 3600,
};

export type SimulationSettings = {
  version: string;
  timing: Timing;
  globalDemandMultiplier: number;
  demandModel: DemandModel;
  minimumPressure: number;
  requiredPressure: number;
  pressureExponent: number;
  emitterExponent: number;
  trials?: number;
  accuracy?: number;
  unbalancedMode?: UnbalancedMode;
  unbalancedExtraTrials?: number;
  headError?: number;
  flowChange?: number;
  checkFreq?: number;
  maxCheck?: number;
  dampLimit?: number;
  viscosity?: number;
  specificGravity?: number;
  qualitySimulationType: QualitySimulationType;
  qualityChemicalName: string;
  qualityMassUnit: QualityMassUnit;
  qualityTraceNode: string;
  tolerance: number;
  diffusivity: number;
  reactionBulkOrder: number;
  reactionWallOrder: number;
  reactionTankOrder: number;
  reactionGlobalBulk: number;
  reactionGlobalWall: number;
  reactionLimitingPotential: number;
  reactionRoughnessCorrelation: number;
};

export const defaultHydraulicsValues = {
  trials: 40,
  accuracy: 0.001,
  unbalancedMode: "STOP" as UnbalancedMode,
  unbalancedExtraTrials: 0,
  headError: 0,
  flowChange: 0,
  checkFreq: 2,
  maxCheck: 10,
  dampLimit: 0,
  viscosity: 1.0,
  specificGravity: 1.0,
};

export const defaultWaterQualityValues = {
  qualitySimulationType: "NONE" as QualitySimulationType,
  qualityChemicalName: "",
  qualityMassUnit: "mg/L" as QualityMassUnit,
  qualityTraceNode: "",
  tolerance: 0.01,
  diffusivity: 1.0,
  reactionBulkOrder: 1,
  reactionWallOrder: 1,
  reactionTankOrder: 1,
  reactionGlobalBulk: 0,
  reactionGlobalWall: 0,
  reactionLimitingPotential: 0,
  reactionRoughnessCorrelation: 0,
};

export const defaultSimulationSettings: SimulationSettings = {
  version: nanoid(),
  timing: defaultTiming,
  globalDemandMultiplier: 1,
  demandModel: "DDA",
  minimumPressure: 0,
  requiredPressure: 0.1,
  pressureExponent: 0.5,
  emitterExponent: 0.5,
  ...defaultWaterQualityValues,
};
