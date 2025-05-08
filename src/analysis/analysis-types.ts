import { RangeColorMapping } from "./range-color-mapping";

export type FlowAnalysis = {
  type: "flow";
  rangeColorMapping: RangeColorMapping;
};

export type VelocityAnalysis = {
  type: "velocity";
  rangeColorMapping: RangeColorMapping;
};

export type PropertyAnalysis = {
  type: string;
  rangeColorMapping: RangeColorMapping;
};

export type NodesAnalysis =
  | { type: "none" }
  | { type: "elevation" | "pressure"; rangeColorMapping: RangeColorMapping };

export type LinksAnalysis = { type: "none" } | FlowAnalysis | VelocityAnalysis;

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none" },
  nodes: { type: "none" },
};
