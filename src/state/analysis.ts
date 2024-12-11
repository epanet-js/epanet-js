import { atom } from "jotai";
import { ISymbolizationRamp } from "src/types";

export type PressuresAnalysis = {
  type: "pressures";
  symbolization: ISymbolizationRamp;
};

export type FlowsAnalysis = {
  type: "flows";
  symbolization: ISymbolizationRamp;
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
