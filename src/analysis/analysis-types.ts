import { RangeColorMapping } from "./range-color-mapping";

export type FlowsAnalysis = {
  type: "flows";
  rangeColorMapping: RangeColorMapping;
};

export type VelocitiesAnalysis = {
  type: "velocities";
  rangeColorMapping: RangeColorMapping;
};

export type PressureAnalysis = {
  type: "pressure";
  rangeColorMapping: RangeColorMapping;
};

export type NodesAnalysis = { type: "none" } | PressureAnalysis;

export type LinksAnalysis =
  | { type: "none" }
  | FlowsAnalysis
  | VelocitiesAnalysis;

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none" },
  nodes: { type: "none" },
};
