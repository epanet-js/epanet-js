import { RangeSymbology } from "./range-symbology";

const nodeAnalysisTypes = ["elevation", "pressure"] as const;
const linkAnalysisTypes = ["flow", "velocity", "unitHeadloss"] as const;

const analysisTypes = [
  "none",
  ...nodeAnalysisTypes,
  ...linkAnalysisTypes,
] as const;
export type AnalysisType = (typeof analysisTypes)[number];

export type Labeling = string | null;

export type PropertyAnalysis = {
  type: string;
  symbology: RangeSymbology;
};

export type NodesAnalysis =
  | { type: "none" }
  | {
      type: "elevation" | "pressure";
      symbology: RangeSymbology;
    };

export type LinksAnalysis =
  | { type: "none"; labeling: Labeling }
  | {
      type: "flow" | "velocity" | "unitHeadloss";
      symbology: RangeSymbology;
      labeling: Labeling;
    };

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const nullAnalysis: AnalysisState = {
  links: { type: "none", labeling: null },
  nodes: { type: "none" },
};
