import { RangeColorRule } from "./range-symbology";

const nodeAnalysisTypes = ["elevation", "pressure"] as const;
const linkAnalysisTypes = [
  "flow",
  "velocity",
  "unitHeadloss",
  "diameter",
] as const;

const analysisTypes = [
  "none",
  ...nodeAnalysisTypes,
  ...linkAnalysisTypes,
] as const;
export type AnalysisType = (typeof analysisTypes)[number];

export type LabelRule = string | null;

export type PropertyAnalysis = {
  type: string;
  colorRule: RangeColorRule;
  labelRule: LabelRule;
};

export type NodeSymbology =
  | { type: "none"; labelRule: LabelRule }
  | {
      type: "elevation" | "pressure";
      colorRule: RangeColorRule;
      labelRule: LabelRule;
    };

export type LinkSymbology =
  | { type: "none"; labelRule: LabelRule }
  | {
      type: "flow" | "velocity" | "unitHeadloss" | "diameter";
      colorRule: RangeColorRule;
      labelRule: LabelRule;
    };

export type AnalysisState = {
  nodes: NodeSymbology;
  links: LinkSymbology;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none", labelRule: null },
  nodes: { type: "none", labelRule: null },
};
