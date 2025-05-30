import { atom, useAtom } from "jotai";
import { AnalysisState, LinkSymbology, NodeSymbology } from "src/analysis";

export type { AnalysisState };

export type AnalysesMap = Map<string, NodeSymbology | LinkSymbology>;
export const savedAnalysesAtom = atom<AnalysesMap>(new Map());

export const nodesAnalysisAtom = atom<NodeSymbology>({
  type: "none",
  labeling: null,
});
export const linksAnalysisAtom = atom<LinkSymbology>({
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

  const switchNodeSymbologyTo = (
    type: NodeSymbology["type"],
    initializeFn: () => NodeSymbology,
  ) => {
    if (savedAnalyses.has(type)) {
      const nodesAnalysis = savedAnalyses.get(type) as NodeSymbology;
      setNodesActive(nodesAnalysis);
    } else {
      const nodesAnalysis = initializeFn();
      setNodesActive(nodesAnalysis);
      const analysesMap = new Map([...savedAnalyses.entries()]);
      analysesMap.set(nodesAnalysis.type, nodesAnalysis);
      setSavedAnalyises(analysesMap);
    }
  };

  const switchLinkSymbologyTo = (
    type: LinkSymbology["type"],
    initializeFn: () => LinkSymbology,
  ) => {
    if (savedAnalyses.has(type)) {
      const linksAnalysis = savedAnalyses.get(type) as LinkSymbology;
      setLinksActive(linksAnalysis);
    } else {
      const linksAnalysis = initializeFn();
      setLinksActive(linksAnalysis);
      const analysesMap = new Map([...savedAnalyses.entries()]);
      analysesMap.set(linksAnalysis.type, linksAnalysis);
      setSavedAnalyises(analysesMap);
    }
  };

  const updateNodeSymbology = (newNodeSymbology: NodeSymbology) => {
    setNodesActive(newNodeSymbology);
    const analysesMap = new Map([...savedAnalyses.entries()]);
    analysesMap.set(newNodeSymbology.type, newNodeSymbology);
    setSavedAnalyises(analysesMap);
  };

  const updateLinkSymbology = (newLinkSymbology: LinkSymbology) => {
    setLinksActive(newLinkSymbology);
    const analysesMap = new Map([...savedAnalyses.entries()]);
    analysesMap.set(newLinkSymbology.type, newLinkSymbology);
    setSavedAnalyises(analysesMap);
  };

  return {
    linksAnalysis,
    nodesAnalysis,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
    updateNodeSymbology,
    updateLinkSymbology,
  };
};
