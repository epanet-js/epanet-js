import { atom, useAtom } from "jotai";
import { SymbologySpec, LinkSymbology, NodeSymbology } from "src/map/symbology";
import { SupportedProperty } from "src/map/symbology/symbology-types";

export type { SymbologySpec };

type SymbologiesMap = Map<SupportedProperty, NodeSymbology | LinkSymbology>;
export const savedSymbologiesAtom = atom<SymbologiesMap>(new Map());

export const nodeSymbologyAtom = atom<NodeSymbology>({
  type: "none",
  labelRule: null,
});
export const linkSymbologyAtom = atom<LinkSymbology>({
  type: "none",
  labelRule: null,
});

export const symbologyAtom = atom((get) => {
  const node = get(nodeSymbologyAtom);
  const link = get(linkSymbologyAtom);

  return { node, link };
});

export const useSymbologySpec = () => {
  const [savedSymbologies, setSavedAnalyises] = useAtom(savedSymbologiesAtom);
  const [nodeSymbology, setNodesActive] = useAtom(nodeSymbologyAtom);
  const [linkSymbology, setLinksActive] = useAtom(linkSymbologyAtom);

  const switchNodeSymbologyTo = (
    type: NodeSymbology["type"],
    initializeFn: () => NodeSymbology,
  ) => {
    if (type !== "none" && savedSymbologies.has(type)) {
      const nodeSymbology = savedSymbologies.get(type) as NodeSymbology;
      setNodesActive(nodeSymbology);
    } else {
      const nodeSymbology = initializeFn();
      updateNodeSymbology(nodeSymbology);
    }
  };

  const switchLinkSymbologyTo = (
    type: LinkSymbology["type"],
    initializeFn: () => LinkSymbology,
  ) => {
    if (type !== "none" && savedSymbologies.has(type)) {
      const linkSymbology = savedSymbologies.get(type) as LinkSymbology;
      setLinksActive(linkSymbology);
    } else {
      const linkSymbology = initializeFn();
      updateLinkSymbology(linkSymbology);
    }
  };

  const updateNodeSymbology = (newNodeSymbology: NodeSymbology) => {
    setNodesActive(newNodeSymbology);
    if (newNodeSymbology.type === "none") return;
    const symbologiesMap = new Map([...savedSymbologies.entries()]);
    symbologiesMap.set(newNodeSymbology.type, newNodeSymbology);
    setSavedAnalyises(symbologiesMap);
  };

  const updateLinkSymbology = (newLinkSymbology: LinkSymbology) => {
    setLinksActive(newLinkSymbology);
    if (newLinkSymbology.type === "none") return;
    const symbologiesMap = new Map([...savedSymbologies.entries()]);
    symbologiesMap.set(newLinkSymbology.type, newLinkSymbology);
    setSavedAnalyises(symbologiesMap);
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
