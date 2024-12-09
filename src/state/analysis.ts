import { atom } from "jotai";

export type NodesAnalysis = "none" | "pressures";

type AnalysisState = {
  nodes: NodesAnalysis;
};

export const analysisAtom = atom<AnalysisState>({
  nodes: "none",
});
