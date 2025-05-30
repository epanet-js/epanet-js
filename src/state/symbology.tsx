import { atom, useAtom } from "jotai";
import { SymbologySpec, LinkSymbology, NodeSymbology } from "src/map/symbology";
import {
  SupportedProperty,
  nullSymbologySpec,
} from "src/map/symbology/symbology-types";

export type { SymbologySpec };

type SymbologiesMap = Map<SupportedProperty, NodeSymbology | LinkSymbology>;
export const savedSymbologiesAtom = atom<SymbologiesMap>(new Map());

export const nodeSymbologyAtom = atom<NodeSymbology>(nullSymbologySpec.node);
export const linkSymbologyAtom = atom<LinkSymbology>(nullSymbologySpec.link);

export const symbologyAtom = atom((get) => {
  const node = get(nodeSymbologyAtom);
  const link = get(linkSymbologyAtom);

  return { node, link };
});

export const useSymbologyState = () => {
  const [savedSymbologies, setSavedAnalyises] = useAtom(savedSymbologiesAtom);
  const [nodeSymbology, setNodesActive] = useAtom(nodeSymbologyAtom);
  const [linkSymbology, setLinksActive] = useAtom(linkSymbologyAtom);

  const switchNodeSymbologyTo = (
    property: SupportedProperty | null,
    initializeFn: () => NodeSymbology,
  ) => {
    if (property === null) {
      setNodesActive(nullSymbologySpec.node);
      return;
    }

    let nodeSymbology;
    if (savedSymbologies.has(property)) {
      nodeSymbology = savedSymbologies.get(property);
    } else {
      nodeSymbology = initializeFn();
      updateNodeSymbology(nodeSymbology);
    }
    setNodesActive(nodeSymbology as NodeSymbology);
  };

  const switchLinkSymbologyTo = (
    property: SupportedProperty | null,
    initializeFn: () => LinkSymbology,
  ) => {
    if (property === null) {
      setLinksActive(nullSymbologySpec.link);
      return;
    }

    let linkSymbology;
    if (savedSymbologies.has(property)) {
      linkSymbology = savedSymbologies.get(property);
    } else {
      linkSymbology = initializeFn();
      updateLinkSymbology(linkSymbology);
    }
    setLinksActive(linkSymbology as LinkSymbology);
  };

  const updateNodeSymbology = (newNodeSymbology: NodeSymbology) => {
    setNodesActive(newNodeSymbology);
    if (!newNodeSymbology.colorRule) return;

    const symbologiesMap = new Map([...savedSymbologies.entries()]);
    symbologiesMap.set(
      newNodeSymbology.colorRule.property as SupportedProperty,
      newNodeSymbology,
    );
    setSavedAnalyises(symbologiesMap);
  };

  const updateLinkSymbology = (newLinkSymbology: LinkSymbology) => {
    setLinksActive(newLinkSymbology);
    if (!newLinkSymbology.colorRule) return;

    const symbologiesMap = new Map([...savedSymbologies.entries()]);
    symbologiesMap.set(
      newLinkSymbology.colorRule.property as SupportedProperty,
      newLinkSymbology,
    );
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
