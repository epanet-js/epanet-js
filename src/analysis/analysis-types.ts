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
  symbology: RangeColorRule;
  label: LabelRule;
};

export type NodeSymbology =
  | { type: "none"; label: LabelRule }
  | {
      type: "elevation" | "pressure";
      symbology: RangeColorRule;
      label: LabelRule;
    };

export type LinkSymbology =
  | { type: "none"; label: LabelRule }
  | {
      type: "flow" | "velocity" | "unitHeadloss" | "diameter";
      symbology: RangeColorRule;
      label: LabelRule;
    };

export type AnalysisState = {
  nodes: NodeSymbology;
  links: LinkSymbology;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none", label: null },
  nodes: { type: "none", label: null },
};
