export const chemicalSourceTypes = [
  "concen",
  "mass",
  "flowpaced",
  "setpoint",
] as const;
export type ChemicalSourceType = (typeof chemicalSourceTypes)[number];

export const pipeStatuses = ["open", "closed", "cv"] as const;
export type PipeStatus = (typeof pipeStatuses)[number];

export const pumpStatuses = ["on", "off"] as const;
export type PumpStatus = (typeof pumpStatuses)[number];

export const pumpDefinitionTypes = [
  "power",
  "designPointCurve",
  "standardCurve",
  "curveId",
] as const;
export type PumpDefinitionType = (typeof pumpDefinitionTypes)[number];

export const valveStatuses = ["active", "open", "closed"] as const;
export type ValveStatus = (typeof valveStatuses)[number];

export const valveKinds = [
  "prv",
  "psv",
  "fcv",
  "pbv",
  "tcv",
  "gpv",
  "pcv",
] as const;
export type ValveKind = (typeof valveKinds)[number];

export const tankMixingModels = ["mixed", "2comp", "fifo", "lifo"] as const;
export type TankMixingModel = (typeof tankMixingModels)[number];
