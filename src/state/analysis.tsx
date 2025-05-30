import { atom, useAtom } from "jotai";
import { SymbologySpec, LinkSymbology, NodeSymbology } from "src/analysis";

export type { SymbologySpec };

export type AnalysesMap = Map<string, NodeSymbology | LinkSymbology>;
export const savedAnalysesAtom = atom<AnalysesMap>(new Map());

export const nodeSymbologyAtom = atom<NodeSymbology>({
  type: "none",
  labelRule: null,
});
export const linkSymbologyAtom = atom<LinkSymbology>({
  type: "none",
  labelRule: null,
});

export const symbologyAtom = atom((get) => {
  const nodes = get(nodeSymbologyAtom);
  const links = get(linkSymbologyAtom);

  return { nodes, links };
});

export const useSymbologySpec = () => {
  const [savedAnalyses, setSavedAnalyises] = useAtom(savedAnalysesAtom);
  const [nodeSymbology, setNodesActive] = useAtom(nodeSymbologyAtom);
  const [linkSymbology, setLinksActive] = useAtom(linkSymbologyAtom);

  const switchNodeSymbologyTo = (
    type: NodeSymbology["type"],
    initializeFn: () => NodeSymbology,
  ) => {
    if (savedAnalyses.has(type)) {
      const nodeSymbology = savedAnalyses.get(type) as NodeSymbology;
      setNodesActive(nodeSymbology);
    } else {
      const nodeSymbology = initializeFn();
      setNodesActive(nodeSymbology);
      const analysesMap = new Map([...savedAnalyses.entries()]);
      analysesMap.set(nodeSymbology.type, nodeSymbology);
      setSavedAnalyises(analysesMap);
    }
  };

  const switchLinkSymbologyTo = (
    type: LinkSymbology["type"],
    initializeFn: () => LinkSymbology,
  ) => {
    if (savedAnalyses.has(type)) {
      const linkSymbology = savedAnalyses.get(type) as LinkSymbology;
      setLinksActive(linkSymbology);
    } else {
      const linkSymbology = initializeFn();
      setLinksActive(linkSymbology);
      const analysesMap = new Map([...savedAnalyses.entries()]);
      analysesMap.set(linkSymbology.type, linkSymbology);
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
    linkSymbology,
    nodeSymbology,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
    updateNodeSymbology,
    updateLinkSymbology,
  };
};
