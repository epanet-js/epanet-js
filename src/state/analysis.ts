import { atom } from "jotai";
import { ISymbolizationRamp } from "src/types";

export type PressuresAnalysis = {
  type: "pressures";
  symbolization: ISymbolizationRamp;
};

export type NodesAnalysis = { type: "none" } | PressuresAnalysis;

export type AnalysisState = {
  nodes: NodesAnalysis;
};

export const analysisAtom = atom<AnalysisState>({
  nodes: { type: "none" },
});
