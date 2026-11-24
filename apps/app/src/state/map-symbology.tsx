import { atom } from "jotai";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import type { SimulationState } from "src/state/simulation";
import { isColorPropertyAvailable } from "src/map/symbology/property-availability";
import { PersistenceMetadataMemory } from "src/lib/persistence/ipersistence";
import { SYMBOLIZATION_NONE } from "src/types";
import {
  SymbologySpec,
  LinkSymbology,
  NodeSymbology,
  CustomerPointsSymbology,
  ZoneSymbology,
} from "src/map/symbology";
import {
  SupportedProperty,
  nullSymbologySpec,
} from "src/map/symbology/symbology-types";
import { defaultNodeSizeConfig, type NodeSizeConfig } from "src/map/symbology";
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
  minPressure: {
    rampName: "Temps",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
  maxPressure: {
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
  chemicalConcentration: {
    rampName: "BluGrn",
    mode: "prettyBreaks",
    reversedRamp: false,
    numIntervals: 5,
  },
};

export const propertyColorConfigAtom = atom<PropertyColorConfigMap>(
  defaultPropertyColorConfigs,
);

export const nodeSymbologyAtom = atom<NodeSymbology>(nullSymbologySpec.node);
export const linkSymbologyAtom = atom<LinkSymbology>(nullSymbologySpec.link);
export const nodeSizeAtom = atom<NodeSizeConfig>(defaultNodeSizeConfig);

export const customerPointsSymbologyAtom = atom<CustomerPointsSymbology>(
  nullSymbologySpec.customerPoints,
);

export const customerPointsVisibleAtom = atom(
  (get) => get(customerPointsSymbologyAtom).visible,
);

export const zoneSymbologyAtom = atom<ZoneSymbology>(nullSymbologySpec.zone);

export const zonesVisibleAtom = atom((get) => get(zoneSymbologyAtom).visible);

const isRuleAvailable = (
  rule: NodeSymbology["colorRule"],
  simulation: SimulationState,
) => !rule || isColorPropertyAvailable(rule.property, simulation);

export const nodeColorRuleAvailableAtom = atom((get) =>
  isRuleAvailable(get(nodeSymbologyAtom).colorRule, get(simulationDerivedAtom)),
);

export const linkColorRuleAvailableAtom = atom((get) =>
  isRuleAvailable(get(linkSymbologyAtom).colorRule, get(simulationDerivedAtom)),
);

export const symbologyAtom = atom((get) => {
  const node = get(nodeSymbologyAtom);
  const link = get(linkSymbologyAtom);
  const customerPoints = get(customerPointsSymbologyAtom);
  const zone = get(zoneSymbologyAtom);

  return { node, link, customerPoints, zone };
});
