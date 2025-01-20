import { atom } from "jotai";
import { AnalysisState } from "src/analysis";

export type { AnalysisState };
export const analysisAtom = atom<AnalysisState>({
  nodes: { type: "none" },
  links: { type: "none" },
});
