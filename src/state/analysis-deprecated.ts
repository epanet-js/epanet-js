import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { AnalysisState } from "src/analysis";

export type { AnalysisState };
export const analysisAtomDeprecated = atom<AnalysisState>({
  nodes: { type: "none" },
  links: { type: "none" },
});

export const linksAnalysisAtomDeprecated = focusAtom(
  analysisAtomDeprecated,
  (optic) => optic.prop("links"),
);
export const nodesAnalysisAtomDeprecated = focusAtom(
  analysisAtomDeprecated,
  (optic) => optic.prop("nodes"),
);
