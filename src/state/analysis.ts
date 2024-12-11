import { atom } from "jotai";
import { RangeColorMapping } from "src/analysis/range-color-mapping";

export type PressuresAnalysis = {
  type: "pressures";
  rangeColorMapping: RangeColorMapping;
};

export type FlowsAnalysis = {
  type: "flows";
  rangeColorMapping: RangeColorMapping;
};

export type NodesAnalysis = { type: "none" } | PressuresAnalysis;
export type LinksAnalysis = { type: "none" } | FlowsAnalysis;

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const analysisAtom = atom<AnalysisState>({
  nodes: { type: "none" },
  links: { type: "none" },
});
