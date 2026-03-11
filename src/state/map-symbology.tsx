import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
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
import { type RangeMode, getColors } from "src/map/symbology/range-color-rule";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export type { SymbologySpec };

export type PreviewProperty = PersistenceMetadataMemory["label"];

export const memoryMetaAtom = atom<Omit<PersistenceMetadataMemory, "type">>({
  symbology: SYMBOLIZATION_NONE,
  label: null,
  layer: null,
});

type SymbologiesMap = Map<SupportedProperty, NodeSymbology | LinkSymbology>;
export const savedSymbologiesAtom = atom<SymbologiesMap>(new Map());

export type RangeColorPreference = {
  rampName: string;
  mode: RangeMode;
  numIntervals: number;
  reversedRamp: boolean;
  customColors?: string[];
};

type SymbologyColorPreferences = Partial<
  Record<SupportedProperty, RangeColorPreference>
>;

const symbologyColorPreferencesAtom =
  atomWithStorage<SymbologyColorPreferences>("symbology-color-preferences", {});

export const nodeSymbologyAtom = atom<NodeSymbology>(nullSymbologySpec.node);
export const linkSymbologyAtom = atom<LinkSymbology>(nullSymbologySpec.link);
const customerPointsSymbologyAtom = atom<CustomerPointsSymbology>(
  nullSymbologySpec.customerPoints,
);

const customerPointsSymbologyPreferenceAtom =
  atomWithStorage<CustomerPointsSymbology>(
    "customer-points-symbology",
    nullSymbologySpec.customerPoints,
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
  const [customerPointsPreference, setCustomerPointPreference] = useAtom(
    customerPointsSymbologyPreferenceAtom,
  );
  const [symbologyPreferences, setSymbologyPreferences] = useAtom(
    symbologyColorPreferencesAtom,
  );

  const isPersistOn = useFeatureFlag("FLAG_RESTORE_MAP_PREFERENCES");

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

  const savePreference = (colorRule: {
    property: string;
    rampName: string;
    mode: RangeMode;
    colors: string[];
    reversedRamp?: boolean;
  }) => {
    const property = colorRule.property as SupportedProperty;
    const numIntervals = colorRule.colors.length;
    const rampColors = getColors(
      colorRule.rampName,
      numIntervals,
      Boolean(colorRule.reversedRamp),
    );
    const hasCustomColors =
      colorRule.colors.length !== rampColors.length ||
      colorRule.colors.some((c, i) => c !== rampColors[i]);

    setSymbologyPreferences({
      ...symbologyPreferences,
      [property]: {
        rampName: colorRule.rampName,
        mode: colorRule.mode === "manual" ? "prettyBreaks" : colorRule.mode,
        numIntervals,
        reversedRamp: Boolean(colorRule.reversedRamp),
        ...(hasCustomColors ? { customColors: colorRule.colors } : {}),
      },
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
    savePreference(newNodeSymbology.colorRule);
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
    savePreference(newLinkSymbology.colorRule);
  };

  const updateCustomerPointsSymbology = (
    newCustomerPointsSymbology: CustomerPointsSymbology,
  ) => {
    setCustomerPointsSymbology(newCustomerPointsSymbology);
    setCustomerPointPreference(newCustomerPointsSymbology);
  };

  return {
    linkSymbology,
    nodeSymbology,
    customerPointsSymbology: isPersistOn
      ? customerPointsPreference
      : customerPointsSymbology,
    symbologyPreferences,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
    updateNodeSymbology,
    updateLinkSymbology,
    updateCustomerPointsSymbology,
  };
};
