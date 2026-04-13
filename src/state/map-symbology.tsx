import { atom, useAtom } from "jotai";
import { PersistenceMetadataMemory } from "src/lib/persistence/ipersistence";
import { SYMBOLIZATION_NONE } from "src/types";
import {
  SymbologySpec,
  LinkSymbology,
  NodeSymbology,
  CustomerPointsSymbology,
} from "src/map/symbology";
import {
  SupportedProperty,
  nullSymbologySpec,
} from "src/map/symbology/symbology-types";
import { type ColorRuleConfig } from "src/map/symbology/range-color-rule";

export type { SymbologySpec };

export type PreviewProperty = PersistenceMetadataMemory["label"];

export const memoryMetaAtom = atom<Omit<PersistenceMetadataMemory, "type">>({
  symbology: SYMBOLIZATION_NONE,
  label: null,
  layer: null,
});

type PropertyColorConfigMap = Record<SupportedProperty, ColorRuleConfig>;

export const defaultPropertyColorConfigs: PropertyColorConfigMap = {
  diameter: {
    rampName: "SunsetDark",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 7,
  },
  roughness: {
    rampName: "Emrld",
    mode: "ckmeans",
    reversedRamp: false,
    numIntervals: 5,
  },
  elevation: {
    rampName: "Fall",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  flow: {
    rampName: "Teal",
    mode: "equalQuantiles",
    reversedRamp: false,
    numIntervals: 5,
  },
  velocity: {
    rampName: "RedOr",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  unitHeadloss: {
    rampName: "Emrld",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  pressure: {
    rampName: "Temps",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  actualDemand: {
    rampName: "Emrld",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  head: {
    rampName: "Purp",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  waterAge: {
    rampName: "Sunset",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  waterTrace: {
    rampName: "PuBu",
    mode: "equalIntervals",
    reversedRamp: false,
    numIntervals: 5,
  },
};

export const propertyColorConfigAtom = atom<PropertyColorConfigMap>(
  defaultPropertyColorConfigs,
);

type SymbologiesMap = Map<SupportedProperty, NodeSymbology | LinkSymbology>;
export const savedSymbologiesAtom = atom<SymbologiesMap>(new Map());

export const nodeSymbologyAtom = atom<NodeSymbology>(nullSymbologySpec.node);
export const linkSymbologyAtom = atom<LinkSymbology>(nullSymbologySpec.link);

const customerPointsSymbologyAtom = atom<CustomerPointsSymbology>(
  nullSymbologySpec.customerPoints,
);

/**
 * Write-only atom: clears the active node/link symbology when its color rule
 * references the given property, and removes the entry from the saved
 * symbologies map. Useful when a property becomes unavailable (e.g. running a
 * simulation without water age after the user had styled by "waterAge").
 */
export const clearSymbologyForPropertyAtom = atom(
  null,
  (_get, set, property: SupportedProperty) => {
    set(nodeSymbologyAtom, (prev) => {
      if (prev.colorRule?.property !== property) return prev;
      return { ...nullSymbologySpec.node, defaults: prev.defaults };
    });
    set(linkSymbologyAtom, (prev) => {
      if (prev.colorRule?.property !== property) return prev;
      return { ...nullSymbologySpec.link, defaults: prev.defaults };
    });
    set(savedSymbologiesAtom, (prev) => {
      if (!prev.has(property)) return prev;
      const next = new Map(prev);
      next.delete(property);
      return next;
    });
  },
);

export const symbologyAtom = atom((get) => {
  const node = get(nodeSymbologyAtom);
  const link = get(linkSymbologyAtom);
  const customerPoints = get(customerPointsSymbologyAtom);

  return { node, link, customerPoints };
});

export const useSymbologyState = () => {
  const [savedSymbologies, setSavedAnalyises] = useAtom(savedSymbologiesAtom);
  const [nodeSymbology, setNodesActive] = useAtom(nodeSymbologyAtom);
  const [linkSymbology, setLinksActive] = useAtom(linkSymbologyAtom);
  const [customerPointsSymbology, setCustomerPointsSymbology] = useAtom(
    customerPointsSymbologyAtom,
  );
  const switchNodeSymbologyTo = (
    property: SupportedProperty | null,
    initializeFn: () => NodeSymbology,
  ) => {
    if (property === null) {
      setNodesActive({
        ...nullSymbologySpec.node,
        defaults: nodeSymbology.defaults,
      });
      return;
    }

    let newNodeSymbology: NodeSymbology;
    if (savedSymbologies.has(property)) {
      newNodeSymbology = savedSymbologies.get(property) as NodeSymbology;
    } else {
      newNodeSymbology = initializeFn();
      updateNodeSymbology(newNodeSymbology);
    }
    setNodesActive({ ...newNodeSymbology, defaults: nodeSymbology.defaults });
  };

  const switchLinkSymbologyTo = (
    property: SupportedProperty | null,
    initializeFn: () => LinkSymbology,
  ) => {
    if (property === null) {
      setLinksActive({
        ...nullSymbologySpec.link,
        defaults: linkSymbology.defaults,
      });
      return;
    }

    let newLinkSymbology: LinkSymbology;
    if (savedSymbologies.has(property)) {
      newLinkSymbology = savedSymbologies.get(property) as LinkSymbology;
    } else {
      newLinkSymbology = initializeFn();
      updateLinkSymbology(newLinkSymbology);
    }
    setLinksActive({ ...newLinkSymbology, defaults: linkSymbology.defaults });
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

  const updateCustomerPointsSymbology = (
    newCustomerPointsSymbology: CustomerPointsSymbology,
  ) => {
    setCustomerPointsSymbology(newCustomerPointsSymbology);
  };

  const updateNodeDefaultColor = (color: string) => {
    setNodesActive({
      ...nodeSymbology,
      defaults: { ...nodeSymbology.defaults, color },
    });
  };

  const updateLinkDefaultColor = (color: string) => {
    setLinksActive({
      ...linkSymbology,
      defaults: { ...linkSymbology.defaults, color },
    });
  };

  return {
    linkSymbology,
    nodeSymbology,
    customerPointsSymbology,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
    updateNodeSymbology,
    updateLinkSymbology,
    updateCustomerPointsSymbology,
    updateNodeDefaultColor,
    updateLinkDefaultColor,
  };
};
