import { atom } from "jotai";
import { AnalysisState } from "src/analysis";

export type { AnalysisState };

export const linksAnalysisAtomDeprecated = atom<AnalysisState["links"]>({
  type: "none",
});
export const nodesAnalysisAtomDeprecated = atom<AnalysisState["nodes"]>({
  type: "none",
});

export const analysisAtomDeprecated = atom((get) => {
  const nodes = get(nodesAnalysisAtomDeprecated);
  const links = get(linksAnalysisAtomDeprecated);

  return { nodes, links };
});
