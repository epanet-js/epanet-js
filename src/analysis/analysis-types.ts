import { SymbolizationRamp } from "./symbolization-ramp";

const nodeAnalysisTypes = ["elevation", "pressure"] as const;
const linkAnalysisTypes = ["flow", "velocity"] as const;

const analysisTypes = [
  "none",
  ...nodeAnalysisTypes,
  ...linkAnalysisTypes,
] as const;
export type AnalysisType = (typeof analysisTypes)[number];

export type FlowAnalysis = {
  type: "flow";
  symbolization: SymbolizationRamp;
};

export type VelocityAnalysis = {
  type: "velocity";
  symbolization: SymbolizationRamp;
};

export type PropertyAnalysis = {
  type: string;
  label?: string;
  symbolization: SymbolizationRamp;
};

export type NodesAnalysis =
  | { type: "none" }
  | {
      type: "elevation" | "pressure";
      symbolization: SymbolizationRamp;
    };

export type LinksAnalysis = { type: "none" } | FlowAnalysis | VelocityAnalysis;

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none" },
  nodes: { type: "none" },
};
