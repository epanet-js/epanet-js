import { atom, type Setter } from "jotai";
import type { MapThemeSpec } from "@epanet-js/ejsdb";
import isEqual from "lodash/isEqual";
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
import { toMapThemeSpec } from "src/lib/db/mappers/map-themes/to-rows";

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

export const defaultMapThemeSymbology: MapThemeSymbology = {
  node: nullSymbologySpec.node,
  link: nullSymbologySpec.link,
  nodeSize: defaultNodeSizeConfig,
  zone: nullSymbologySpec.zone,
  customerPoints: nullSymbologySpec.customerPoints,
  basemap: defaultBasemapState,
};

export const mapThemesAtom = atom<MapTheme[]>([]);

export const activeMapThemeIdAtom = atom<string | null>(null);

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

export const applyMapThemeSymbologyAtom = atom(
  null,
  (get, set, theme: MapTheme | null) => {
    const { units } = get(projectSettingsAtom);
    const hydraulicModel = get(stagingModelDerivedAtom);
    const simulationResults = get(simulationResultsDerivedAtom);

    const symbology = theme
      ? buildMapThemeSymbology(theme.spec, (rule) =>
          resolveThemeColorRule(rule, units, hydraulicModel, simulationResults),
        )
      : defaultMapThemeSymbology;

    setSymbology(set, symbology);
  },
);

export const currentMapThemeSpecAtom = atom((get) =>
  toMapThemeSpec(get(currentMapThemeSymbologyAtom)),
);

export const markMapThemeAppliedAtom = atom(null, (get, set) => {
  set(appliedMapThemeSymbologyAtom, get(currentMapThemeSymbologyAtom));
});

export const resetMapThemeChangesAtom = atom(null, (get, set) => {
  setSymbology(set, get(appliedMapThemeSymbologyAtom));
});

export const resetActiveMapThemeAtom = atom(null, (get, set) => {
  set(activeMapThemeIdAtom, null);
  set(appliedMapThemeSymbologyAtom, get(currentMapThemeSymbologyAtom));
});
