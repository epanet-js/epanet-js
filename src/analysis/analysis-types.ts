import { RangeSymbology } from "./range-symbology";

const nodeAnalysisTypes = ["elevation", "pressure"] as const;
const linkAnalysisTypes = ["flow", "velocity", "unitHeadloss"] as const;

const analysisTypes = [
  "none",
  ...nodeAnalysisTypes,
  ...linkAnalysisTypes,
] as const;
export type AnalysisType = (typeof analysisTypes)[number];

export type FlowAnalysis = {
  type: "flow";
  symbology: RangeSymbology;
};

export type VelocityAnalysis = {
  type: "velocity";
  symbology: RangeSymbology;
};

export type PropertyAnalysis = {
  type: string;
  label?: string;
  symbology: RangeSymbology;
};

export type NodesAnalysis =
  | { type: "none" }
  | {
      type: "elevation" | "pressure";
      symbology: RangeSymbology;
    };

export type LinksAnalysis =
  | { type: "none" }
  | { type: "flow" | "velocity" | "unitHeadloss"; symbology: RangeSymbology };

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none" },
  nodes: { type: "none" },
};
