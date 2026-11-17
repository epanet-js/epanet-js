import { useAtom } from "jotai";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import type {
  CustomerPointsSymbology,
  LinkSymbology,
  NodeSymbology,
  ZoneSymbology,
} from "src/map/symbology";
import {
  nullSymbologySpec,
  type SupportedProperty,
} from "src/map/symbology/symbology-types";
import {
  customerPointsSymbologyAtom,
  linkSymbologyAtom,
  nodeSymbologyAtom,
  savedSymbologiesAtom,
  zoneSymbologyAtom,
} from "src/state/map-symbology";

export const useSymbologyState = () => {
  const isMapThemesOn = useFeatureFlag("FLAG_MAP_THEMES");
  const [savedSymbologies, setSavedAnalyises] = useAtom(savedSymbologiesAtom);
  const [nodeSymbology, setNodesActive] = useAtom(nodeSymbologyAtom);
  const [linkSymbology, setLinksActive] = useAtom(linkSymbologyAtom);
  const [customerPointsSymbology, setCustomerPointsSymbology] = useAtom(
    customerPointsSymbologyAtom,
  );
  const [zoneSymbology, setZoneSymbology] = useAtom(zoneSymbologyAtom);
  const switchNodeSymbologyTo = (
    property: SupportedProperty | null,
    initializeFn: () => NodeSymbology,
  ) => {
    if (property === null) {
      setNodesActive({
        ...nullSymbologySpec.node,
        defaults: nodeSymbology.defaults,
        labelRule: nodeSymbology.labelRule,
      });
      return;
    }

    let newNodeSymbology: NodeSymbology;
    if (!isMapThemesOn && savedSymbologies.has(property)) {
      newNodeSymbology = savedSymbologies.get(property) as NodeSymbology;
    } else {
      newNodeSymbology = initializeFn();
      updateNodeSymbology(newNodeSymbology);
    }
    setNodesActive({
      ...newNodeSymbology,
      defaults: nodeSymbology.defaults,
      labelRule: nodeSymbology.labelRule,
    });
  };

  const switchLinkSymbologyTo = (
    property: SupportedProperty | null,
    initializeFn: () => LinkSymbology,
  ) => {
    if (property === null) {
      setLinksActive({
        ...nullSymbologySpec.link,
        defaults: linkSymbology.defaults,
        labelRule: linkSymbology.labelRule,
      });
      return;
    }

    let newLinkSymbology: LinkSymbology;
    if (!isMapThemesOn && savedSymbologies.has(property)) {
      newLinkSymbology = savedSymbologies.get(property) as LinkSymbology;
    } else {
      newLinkSymbology = initializeFn();
      updateLinkSymbology(newLinkSymbology);
    }
    setLinksActive({
      ...newLinkSymbology,
      defaults: linkSymbology.defaults,
      labelRule: linkSymbology.labelRule,
    });
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

  const updateZoneSymbology = (updates: Partial<ZoneSymbology>) => {
    setZoneSymbology({ ...zoneSymbology, ...updates });
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
    zoneSymbology,
    updateNodeDefaultColor,
    updateLinkDefaultColor,
    updateZoneSymbology,
  };
};
