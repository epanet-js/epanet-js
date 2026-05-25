import { nanoid } from "nanoid";
import type { PatternId } from "src/hydraulic-model/patterns";

export type DemandModel = "DDA" | "PDA";
export type UnbalancedMode = "STOP" | "CONTINUE";
// ptsnet wave-speed / discretization strategy. "optimal" auto-fits the solver
// time step to the shortest pipe (accurate, but blows up the MOC mesh on
// networks with sub-metre pipes); "user" keeps the requested time step and
// adjusts each pipe's wave speed to fit (always runs, but distorts the wave
// speed of very short pipes).
export type TransientWaveSpeedMethod = "optimal" | "user";

// Transient solver parallelism. The engine runs on Web Workers; leave a couple
// of cores free for the UI / main thread so the browser stays responsive, and
// never request more workers than the device reports.
export const transientThreadHeadroom = 2;
export const minTransientThreads = 1;

/** Cores the current device reports (the upper bound for the thread setting). */
export const maxTransientThreads = (): number =>
  Math.max(minTransientThreads, globalThis.navigator?.hardwareConcurrency ?? 4);

/** Recommended default: device cores minus a sensible headroom. */
export const defaultTransientThreads = (): number =>
  Math.max(
    minTransientThreads,
    maxTransientThreads() - transientThreadHeadroom,
  );

/** Clamp any requested thread count to [1, device cores]. */
export const clampTransientThreads = (value: number): number =>
  Math.min(
    maxTransientThreads(),
    Math.max(minTransientThreads, Math.round(value)),
  );
export type QualitySimulationType = "none" | "chemical" | "age" | "trace";
export type QualityMassUnit = "mg/L" | "ug/L";
export type StatusReport = "YES" | "NO" | "FULL";

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
  backflowAllowed: boolean;
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
  qualityTraceNodeId: number | null;
  tolerance: number;
  diffusivity: number;
  reactionBulkOrder: number;
  reactionWallOrder: number;
  reactionTankOrder: number;
  reactionGlobalBulk: number;
  reactionGlobalWall: number;
  reactionLimitingPotential: number;
  reactionRoughnessCorrelation: number;
  reportEnergy: boolean;
  energyGlobalEfficiency: number;
  energyGlobalPrice: number;
  energyGlobalPatternId: PatternId | null;
  energyDemandCharge: number;
  statusReport: StatusReport;
  // Transient analysis (ptsnet) — PoC: a single valve-closure event.
  transientsEnabled: boolean;
  transientValveId: string;
  transientFinalSetting: number;
  transientStartTime: number;
  transientEndTime: number;
  transientDuration: number;
  transientTimeStep: number;
  transientWaveSpeed: number;
  transientWaveSpeedMethod: TransientWaveSpeedMethod;
  transientThreads: number;
  transientSaveResults: boolean;
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
  qualitySimulationType: "none" as QualitySimulationType,
  qualityChemicalName: "",
  qualityMassUnit: "mg/L" as QualityMassUnit,
  qualityTraceNodeId: null,
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

export const defaultEnergyValues = {
  reportEnergy: false,
  energyGlobalEfficiency: 75,
  energyGlobalPrice: 0,
  energyGlobalPatternId: null as PatternId | null,
  energyDemandCharge: 0,
};

export const defaultReportValues = {
  statusReport: "FULL" as StatusReport,
};

export const defaultTransientValues = {
  transientsEnabled: false,
  transientValveId: "",
  transientFinalSetting: 0,
  transientStartTime: 0,
  transientEndTime: 2,
  transientDuration: 20,
  transientTimeStep: 0.01,
  transientWaveSpeed: 1200,
  transientWaveSpeedMethod: "optimal" as TransientWaveSpeedMethod,
  transientThreads: defaultTransientThreads(),
  transientSaveResults: true,
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
  backflowAllowed: true,
  ...defaultWaterQualityValues,
  ...defaultEnergyValues,
  ...defaultReportValues,
  ...defaultTransientValues,
};
