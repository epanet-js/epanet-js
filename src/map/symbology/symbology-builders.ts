import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { initializeColorRule } from "./range-color-rule";
import {
  NodeSymbology,
  LinkSymbology,
  nullSymbologySpec,
} from "./symbology-types";
import { nullLabelRule } from "./labeling";
import type { RangeEndpoints } from "./range-color-rule";
import type { Unit } from "src/quantity";
import { defaultPropertyColorConfigs } from "src/state/map-symbology";

const VELOCITY_FALLBACK_ENDPOINTS: Record<string, RangeEndpoints> = {
  "m/s": [0, 4],
  "ft/s": [0, 10],
};

const UNIT_HEADLOSS_FALLBACK_ENDPOINTS: Record<string, RangeEndpoints> = {
  "m/km": [0, 5],
  "ft/kft": [3, 12],
};

const getFallbackEndpoints = (
  unit: Unit,
  endpoints: Record<string, RangeEndpoints>,
): RangeEndpoints => {
  const result = endpoints[unit as string];
  if (!result) throw new Error(`No fallback endpoints for unit: ${unit}`);
  return result;
};

const defaults = defaultPropertyColorConfigs;

type SymbologyBuilderFn<T> = (units: UnitsSpec, sortedData: number[]) => T;

type SymbologyBuilders = {
  flow: SymbologyBuilderFn<LinkSymbology>;
  diameter: SymbologyBuilderFn<LinkSymbology>;
  roughness: SymbologyBuilderFn<LinkSymbology>;
  unitHeadloss: SymbologyBuilderFn<LinkSymbology>;
  velocity: SymbologyBuilderFn<LinkSymbology>;
  pressure: SymbologyBuilderFn<NodeSymbology>;
  actualDemand: SymbologyBuilderFn<NodeSymbology>;
  elevation: SymbologyBuilderFn<NodeSymbology>;
  head: SymbologyBuilderFn<NodeSymbology>;
  waterAge: SymbologyBuilderFn<NodeSymbology & LinkSymbology>;
  waterTrace: SymbologyBuilderFn<NodeSymbology & LinkSymbology>;
};

export const symbologyBuilders: SymbologyBuilders = {
  diameter: (units, sortedData): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "diameter",
      unit: units.diameter,
      ...defaults.diameter,
      sortedData,
    });
    return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
  },

  roughness: (units, sortedData): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "roughness",
      unit: units.roughness,
      ...defaults.roughness,
      sortedData,
    });
    return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
  },

  elevation: (units, sortedData): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "elevation",
      unit: units.elevation,
      ...defaults.elevation,
      fallbackEndpoints: [0, 100],
      sortedData,
    });
    return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
  },

  flow: (units, sortedData): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "flow",
      unit: units.flow,
      ...defaults.flow,
      absValues: true,
      sortedData,
    });
    return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
  },

  velocity: (units, sortedData): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "velocity",
      unit: units.velocity,
      ...defaults.velocity,
      sortedData,
      fallbackEndpoints: getFallbackEndpoints(
        units.velocity,
        VELOCITY_FALLBACK_ENDPOINTS,
      ),
    });
    return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
  },

  unitHeadloss: (units, sortedData): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "unitHeadloss",
      unit: units.unitHeadloss,
      ...defaults.unitHeadloss,
      sortedData,
      fallbackEndpoints: getFallbackEndpoints(
        units.unitHeadloss,
        UNIT_HEADLOSS_FALLBACK_ENDPOINTS,
      ),
    });
    return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
  },

  pressure: (units, sortedData): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "pressure",
      unit: units.pressure,
      ...defaults.pressure,
      fallbackEndpoints: [0, 100],
      sortedData,
    });
    return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
  },

  actualDemand: (units, sortedData): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "actualDemand",
      unit: units.actualDemand,
      ...defaults.actualDemand,
      fallbackEndpoints: [0, 100],
      sortedData,
    });
    return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
  },

  head: (units, sortedData): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "head",
      unit: units.head,
      ...defaults.head,
      fallbackEndpoints: [0, 100],
      sortedData,
    });
    return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
  },

  waterAge: (units, sortedData): NodeSymbology & LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "waterAge",
      unit: units.waterAge,
      ...defaults.waterAge,
      fallbackEndpoints: [0, 48],
      sortedData,
    });
    return {
      colorRule,
      labelRule: nullLabelRule,
      defaults: nullSymbologySpec.node.defaults,
    };
  },

  waterTrace: (units): NodeSymbology & LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "waterTrace",
      unit: units.waterTrace,
      ...defaults.waterTrace,
      fallbackEndpoints: [0, 100],
      sortedData: [0, 100],
    });
    return {
      colorRule,
      labelRule: nullLabelRule,
      defaults: nullSymbologySpec.node.defaults,
    };
  },
};
