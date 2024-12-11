import { atom } from "jotai";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";

export type AnalysisState = {
  nodes: NodesAnalysis;
  links: LinksAnalysis;
};

export const analysisAtom = atom<AnalysisState>({
  nodes: { type: "none" },
  links: { type: "none" },
});
