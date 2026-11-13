import { atom, type Getter, type Setter } from "jotai";
import type { MapThemeSpec } from "@epanet-js/ejsdb";
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
import { basemapAtom, defaultBasemapState, type Basemap } from "src/state/map";
import {
  buildMapThemeSymbology,
  type ThemeColorRule,
} from "src/lib/db/mappers/map-themes/builders";
import {
  serializeMapThemes,
  toMapThemeSpec,
} from "src/lib/db/mappers/map-themes/to-rows";

export type MapThemeSymbology = {
  node: NodeSymbology;
  link: LinkSymbology;
  nodeSize: NodeSizeConfig;
  zone: ZoneSymbology;
  customerPoints: CustomerPointsSymbology;
  basemap: Basemap;
};

export type MapTheme = {
  id: string;
  name: string;
  spec: MapThemeSpec;
};

export const DEFAULT_MAP_THEME_ID = "default";

export const defaultMapThemeSymbology: MapThemeSymbology = {
  node: nullSymbologySpec.node,
  link: nullSymbologySpec.link,
  nodeSize: defaultNodeSizeConfig,
  zone: nullSymbologySpec.zone,
  customerPoints: nullSymbologySpec.customerPoints,
  basemap: defaultBasemapState,
};

const mapThemesListAtom = atom<MapTheme[]>([]);

export const mapThemesAtom = atom(
  (get) => get(mapThemesListAtom),
  (get, set, update: MapTheme[] | ((prev: MapTheme[]) => MapTheme[])) => {
    const next =
      typeof update === "function" ? update(get(mapThemesListAtom)) : update;
    serializeMapThemes(next);
    set(mapThemesListAtom, next);
  },
);

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
    basemap: get(basemapAtom),
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
  rule: ThemeColorRule,
  units: UnitsSpec,
  hydraulicModel: HydraulicModel,
  simulationResults: ResultsReader | null,
): RangeColorRule => {
  const { property } = rule;
  const absValues = Boolean(
    symbologyBuilders[property](units, []).colorRule!.absValues,
  );
  const sortedData =
    property === "waterTrace"
      ? []
      : getSortedDataForProperty(property, hydraulicModel, simulationResults, {
          absValues,
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
  set(basemapAtom, symbology.basemap);
  set(appliedMapThemeSymbologyAtom, symbology);
};

const applyTheme = (get: Getter, set: Setter, themeId: string) => {
  const theme = get(mapThemesAtom).find((t) => t.id === themeId);
  const id = theme ? theme.id : DEFAULT_MAP_THEME_ID;

  const { units } = get(projectSettingsAtom);
  const hydraulicModel = get(stagingModelDerivedAtom);
  const simulationResults = get(simulationResultsDerivedAtom);

  const symbology = theme
    ? buildMapThemeSymbology(theme.spec, (rule) =>
        resolveThemeColorRule(rule, units, hydraulicModel, simulationResults),
      )
    : defaultMapThemeSymbology;

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
        const theme: MapTheme = {
          id: nanoid(),
          name: action.name,
          spec: toMapThemeSpec(symbology),
        };
        set(mapThemesAtom, (prev) => [...prev, theme]);
        set(activeMapThemeIdAtom, theme.id);
        set(appliedMapThemeSymbologyAtom, symbology);
        return;
      }
      case "saveChanges": {
        const id = get(activeMapThemeIdAtom);
        if (id === DEFAULT_MAP_THEME_ID) return;
        const symbology = get(currentMapThemeSymbologyAtom);
        const spec = toMapThemeSpec(symbology);
        set(mapThemesAtom, (prev) =>
          prev.map((t) => (t.id === id ? { ...t, spec } : t)),
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
          spec: source.spec,
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

export const resetActiveMapThemeAtom = atom(null, (get, set) => {
  set(activeMapThemeIdAtom, DEFAULT_MAP_THEME_ID);
  set(appliedMapThemeSymbologyAtom, get(currentMapThemeSymbologyAtom));
});
