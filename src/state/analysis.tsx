import { atom, useAtom } from "jotai";
import { AnalysisState, LinksAnalysis, NodesAnalysis } from "src/analysis";

export type { AnalysisState };

export type AnalysesMap = Map<string, NodesAnalysis | LinksAnalysis>;
export const savedAnalysesAtom = atom<AnalysesMap>(new Map());

export const nodesAnalysisAtom = atom<NodesAnalysis>({
  type: "none",
  labeling: null,
});
export const linksAnalysisAtom = atom<LinksAnalysis>({
  type: "none",
  labeling: null,
});

export const analysisAtom = atom((get) => {
  const nodes = get(nodesAnalysisAtom);
  const links = get(linksAnalysisAtom);

  return { nodes, links };
});

export const useAnalysisState = () => {
  const [savedAnalyses, setSavedAnalyises] = useAtom(savedAnalysesAtom);
  const [nodesAnalysis, setNodesActive] = useAtom(nodesAnalysisAtom);
  const [linksAnalysis, setLinksActive] = useAtom(linksAnalysisAtom);

  const switchNodesAnalysisTo = (
    type: NodesAnalysis["type"],
    initializeFn: () => NodesAnalysis,
  ) => {
    if (savedAnalyses.has(type)) {
      const nodesAnalysis = savedAnalyses.get(type) as NodesAnalysis;
      setNodesActive(nodesAnalysis);
    } else {
      const nodesAnalysis = initializeFn();
      setNodesActive(nodesAnalysis);
      const analysesMap = new Map([...savedAnalyses.entries()]);
      analysesMap.set(nodesAnalysis.type, nodesAnalysis);
      setSavedAnalyises(analysesMap);
    }
  };

  const switchLinksAnalysisTo = (
    type: LinksAnalysis["type"],
    initializeFn: () => LinksAnalysis,
  ) => {
    if (savedAnalyses.has(type)) {
      const linksAnalysis = savedAnalyses.get(type) as LinksAnalysis;
      setLinksActive(linksAnalysis);
    } else {
      const linksAnalysis = initializeFn();
      setLinksActive(linksAnalysis);
      const analysesMap = new Map([...savedAnalyses.entries()]);
      analysesMap.set(linksAnalysis.type, linksAnalysis);
      setSavedAnalyises(analysesMap);
    }
  };

  const updateNodesAnalysis = (newNodesAnalysis: NodesAnalysis) => {
    setNodesActive(newNodesAnalysis);
    const analysesMap = new Map([...savedAnalyses.entries()]);
    analysesMap.set(newNodesAnalysis.type, newNodesAnalysis);
    setSavedAnalyises(analysesMap);
  };

  const updateLinksAnalysis = (newLinksAnalysis: LinksAnalysis) => {
    setLinksActive(newLinksAnalysis);
    const analysesMap = new Map([...savedAnalyses.entries()]);
    analysesMap.set(newLinksAnalysis.type, newLinksAnalysis);
    setSavedAnalyises(analysesMap);
  };

  return {
    linksAnalysis,
    nodesAnalysis,
    switchNodesAnalysisTo,
    switchLinksAnalysisTo,
    updateNodesAnalysis,
    updateLinksAnalysis,
  };
};
