import { RangeSymbology } from "./range-symbology";

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
  symbology: RangeSymbology;
  labeling: LabelRule;
};

export type NodeSymbology =
  | { type: "none"; labeling: LabelRule }
  | {
      type: "elevation" | "pressure";
      symbology: RangeSymbology;
      labeling: LabelRule;
    };

export type LinkSymbology =
  | { type: "none"; labeling: LabelRule }
  | {
      type: "flow" | "velocity" | "unitHeadloss" | "diameter";
      symbology: RangeSymbology;
      labeling: LabelRule;
    };

export type AnalysisState = {
  nodes: NodeSymbology;
  links: LinkSymbology;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none", labeling: null },
  nodes: { type: "none", labeling: null },
};
