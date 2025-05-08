import { atom } from "jotai";
import { focusAtom } from "jotai-optics";
import { AnalysisState } from "src/analysis";

export type { AnalysisState };
export const analysisAtom = atom<AnalysisState>({
  nodes: { type: "none" },
  links: { type: "none" },
});

export const linksAnalysisAtom = focusAtom(analysisAtom, (optic) =>
  optic.prop("links"),
);
export const nodesAnalysisAtom = focusAtom(analysisAtom, (optic) =>
  optic.prop("nodes"),
);
