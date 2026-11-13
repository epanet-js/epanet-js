// The enum tuples live in `@epanet-js/model-schema`, which the hydraulic model
// reads from too — one source for a value's rule, whichever side names it.
export {
  chemicalSourceTypes,
  curveTypes,
  patternTypes,
  pipeStatuses,
  pumpDefinitionTypes,
  pumpStatuses,
  tankMixingModels,
  valveKinds,
  valveStatuses,
} from "@epanet-js/model-schema";
export type {
  ChemicalSourceType,
  CurveType,
  PatternType,
  PipeStatus,
  PumpDefinitionType,
  PumpStatus,
  TankMixingModel,
  ValveKind,
  ValveStatus,
} from "@epanet-js/model-schema";

export const mapThemeRangeModes = [
  "prettyBreaks",
  "ckmeans",
  "equalQuantiles",
  "equalIntervals",
  "manual",
] as const;
export type MapThemeRangeMode = (typeof mapThemeRangeModes)[number];

export const mapThemeBasemapStyles = [
  "monochrome",
  "satellite",
  "outdoors",
  "streets",
] as const;
export type MapThemeBasemapStyle = (typeof mapThemeBasemapStyles)[number];
