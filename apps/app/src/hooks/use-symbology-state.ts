import { useAtom } from "jotai";
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
  zoneSymbologyAtom,
} from "src/state/map-symbology";

export const useSymbologyState = () => {
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

    setNodesActive({
      ...initializeFn(),
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

    setLinksActive({
      ...initializeFn(),
      defaults: linkSymbology.defaults,
      labelRule: linkSymbology.labelRule,
    });
  };

  const updateNodeSymbology = (newNodeSymbology: NodeSymbology) => {
    setNodesActive(newNodeSymbology);
  };

  const updateLinkSymbology = (newLinkSymbology: LinkSymbology) => {
    setLinksActive(newLinkSymbology);
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
