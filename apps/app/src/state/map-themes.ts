import { atom, type Getter, type Setter } from "jotai";
import isEqual from "lodash/isEqual";
import { nanoid } from "nanoid";
import type { UnitsSpec } from "@epanet-js/project-settings";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ResultsReader } from "@epanet-js/simulation";
import {
  nullSymbologySpec,
  type CustomerPointsSymbology,
  type LinkSymbology,
  type NodeSymbology,
  type SupportedProperty,
  type ZoneSymbology,
} from "src/map/symbology/symbology-types";
import { defaultNodeSizeConfig, type NodeSizeConfig } from "src/map/symbology";
import { symbologyBuilders } from "src/map/symbology/symbology-builders";
import { getSortedDataForProperty } from "src/map/symbology/symbology-data-source";
import {
  applyMode,
  type RangeColorRule,
} from "src/map/symbology/range-color-rule";
import {
  customerPointsSymbologyAtom,
  linkSymbologyAtom,
  nodeSizeAtom,
  nodeSymbologyAtom,
  zoneSymbologyAtom,
} from "src/state/map-symbology";
import {
  simulationResultsDerivedAtom,
  stagingModelDerivedAtom,
} from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";

export type MapThemeSymbology = {
  node: NodeSymbology;
  link: LinkSymbology;
  nodeSize: NodeSizeConfig;
  zone: ZoneSymbology;
  customerPoints: CustomerPointsSymbology;
};

export type MapTheme = {
  id: string;
  name: string;
  symbology: MapThemeSymbology;
};

export const DEFAULT_MAP_THEME_ID = "default";

export const defaultMapThemeSymbology: MapThemeSymbology = {
  node: nullSymbologySpec.node,
  link: nullSymbologySpec.link,
  nodeSize: defaultNodeSizeConfig,
  zone: nullSymbologySpec.zone,
  customerPoints: nullSymbologySpec.customerPoints,
};

export const mapThemesAtom = atom<MapTheme[]>([]);

export const activeMapThemeIdAtom = atom<string>(DEFAULT_MAP_THEME_ID);

const appliedMapThemeSymbologyAtom = atom<MapThemeSymbology>(
  defaultMapThemeSymbology,
);

const currentMapThemeSymbologyAtom = atom(
  (get): MapThemeSymbology => ({
    node: get(nodeSymbologyAtom),
    link: get(linkSymbologyAtom),
    nodeSize: get(nodeSizeAtom),
    zone: get(zoneSymbologyAtom),
    customerPoints: get(customerPointsSymbologyAtom),
  }),
);

export const isMapThemeModifiedAtom = atom(
  (get) =>
    !isEqual(
      get(currentMapThemeSymbologyAtom),
      get(appliedMapThemeSymbologyAtom),
    ),
);

export const resolveThemeColorRule = (
  rule: RangeColorRule,
  units: UnitsSpec,
  hydraulicModel: HydraulicModel,
  simulationResults: ResultsReader | null,
): RangeColorRule => {
  const property = rule.property as SupportedProperty;
  const sortedData =
    property === "waterTrace"
      ? []
      : getSortedDataForProperty(property, hydraulicModel, simulationResults, {
          absValues: Boolean(rule.absValues),
        });
  const base = symbologyBuilders[property](units, sortedData).colorRule!;
  const styled: RangeColorRule = {
    ...base,
    mode: rule.mode,
    rampName: rule.rampName,
    reversedRamp: rule.reversedRamp,
    colors: rule.colors,
    breaks: rule.breaks,
  };
  if (rule.mode === "manual") return styled;
  return applyMode(styled, rule.mode, sortedData).colorRule;
};

const setSymbology = (set: Setter, symbology: MapThemeSymbology) => {
  set(nodeSymbologyAtom, symbology.node);
  set(linkSymbologyAtom, symbology.link);
  set(nodeSizeAtom, symbology.nodeSize);
  set(zoneSymbologyAtom, symbology.zone);
  set(customerPointsSymbologyAtom, symbology.customerPoints);
  set(appliedMapThemeSymbologyAtom, symbology);
};

const applyTheme = (get: Getter, set: Setter, themeId: string) => {
  const theme = get(mapThemesAtom).find((t) => t.id === themeId);
  const stored = theme ? theme.symbology : defaultMapThemeSymbology;
  const id = theme ? theme.id : DEFAULT_MAP_THEME_ID;

  const { units } = get(projectSettingsAtom);
  const hydraulicModel = get(stagingModelDerivedAtom);
  const simulationResults = get(simulationResultsDerivedAtom);
  const resolve = (rule: RangeColorRule | null) =>
    rule
      ? resolveThemeColorRule(rule, units, hydraulicModel, simulationResults)
      : null;

  const symbology: MapThemeSymbology = {
    ...stored,
    node: { ...stored.node, colorRule: resolve(stored.node.colorRule) },
    link: { ...stored.link, colorRule: resolve(stored.link.colorRule) },
  };

  setSymbology(set, symbology);
  set(activeMapThemeIdAtom, id);
};

export type MapThemeAction =
  | { type: "apply"; id: string }
  | { type: "saveAsNew"; name: string }
  | { type: "saveChanges" }
  | { type: "resetChanges" }
  | { type: "rename"; id: string; name: string }
  | { type: "duplicate"; id: string; name: string }
  | { type: "delete"; id: string };

export const mapThemeActionAtom = atom(
  null,
  (get, set, action: MapThemeAction) => {
    switch (action.type) {
      case "apply":
        applyTheme(get, set, action.id);
        return;
      case "saveAsNew": {
        const symbology = get(currentMapThemeSymbologyAtom);
        const theme: MapTheme = { id: nanoid(), name: action.name, symbology };
        set(mapThemesAtom, (prev) => [...prev, theme]);
        set(activeMapThemeIdAtom, theme.id);
        set(appliedMapThemeSymbologyAtom, symbology);
        return;
      }
      case "saveChanges": {
        const id = get(activeMapThemeIdAtom);
        if (id === DEFAULT_MAP_THEME_ID) return;
        const symbology = get(currentMapThemeSymbologyAtom);
        set(mapThemesAtom, (prev) =>
          prev.map((t) => (t.id === id ? { ...t, symbology } : t)),
        );
        set(appliedMapThemeSymbologyAtom, symbology);
        return;
      }
      case "resetChanges":
        setSymbology(set, get(appliedMapThemeSymbologyAtom));
        return;
      case "rename":
        set(mapThemesAtom, (prev) =>
          prev.map((t) =>
            t.id === action.id ? { ...t, name: action.name } : t,
          ),
        );
        return;
      case "duplicate": {
        const source = get(mapThemesAtom).find((t) => t.id === action.id);
        if (!source) return;
        const copy: MapTheme = {
          id: nanoid(),
          name: action.name,
          symbology: source.symbology,
        };
        set(mapThemesAtom, (prev) => [...prev, copy]);
        applyTheme(get, set, copy.id);
        return;
      }
      case "delete":
        set(mapThemesAtom, (prev) => prev.filter((t) => t.id !== action.id));
        if (get(activeMapThemeIdAtom) === action.id)
          applyTheme(get, set, DEFAULT_MAP_THEME_ID);
        return;
    }
  },
);

export const resetActiveMapThemeAtom = atom(null, (_get, set) => {
  set(activeMapThemeIdAtom, DEFAULT_MAP_THEME_ID);
  set(appliedMapThemeSymbologyAtom, defaultMapThemeSymbology);
});
