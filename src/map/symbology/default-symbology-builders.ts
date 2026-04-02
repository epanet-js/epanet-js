import { HydraulicModel } from "src/hydraulic-model";
import type { UnitsSpec } from "src/lib/project-settings/quantities-spec";
import { initializeColorRule } from "./range-color-rule";
import {
  NodeSymbology,
  LinkSymbology,
  nullSymbologySpec,
} from "./symbology-types";
import { nullLabelRule } from "./labeling";
import { getSortedValues } from "src/hydraulic-model/assets-map";
import {
  getSortedSimulationValues,
  type ResultsReader,
} from "src/simulation/results-reader";
import type { RangeEndpoints } from "./range-color-rule";
import type { Unit } from "src/quantity";

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

type SymbologyBuilderFn<T> = (
  hydraulicModel: HydraulicModel,
  units: UnitsSpec,
  resultsReader: ResultsReader,
) => () => T;

type DefaultSymbologyBuilders = {
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
  none: () => () => { colorRule: null; labelRule: null };
};

export const defaultSymbologyBuilders: DefaultSymbologyBuilders = {
  none: () => () => {
    return { colorRule: null, labelRule: null };
  },

  diameter:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      _resultsReader: ResultsReader,
    ) =>
    (): LinkSymbology => {
      const colorRule = initializeColorRule({
        property: "diameter",
        unit: units.diameter,
        rampName: "SunsetDark",
        mode: "prettyBreaks",
        numIntervals: 7,
        sortedData: getSortedValues(hydraulicModel.assets, "diameter"),
      });
      return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
    },

  roughness:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      _resultsReader: ResultsReader,
    ) =>
    (): LinkSymbology => {
      const colorRule = initializeColorRule({
        property: "roughness",
        unit: units.roughness,
        rampName: "Emrld",
        mode: "ckmeans",
        sortedData: getSortedValues(hydraulicModel.assets, "roughness"),
      });
      return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
    },

  elevation:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      _resultsReader: ResultsReader,
    ) =>
    (): NodeSymbology => {
      const colorRule = initializeColorRule({
        property: "elevation",
        unit: units.elevation,
        rampName: "Fall",
        mode: "prettyBreaks",
        fallbackEndpoints: [0, 100],
        sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
      });
      return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
    },

  flow:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): LinkSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "flow", {
        absValues: true,
      });
      const colorRule = initializeColorRule({
        property: "flow",
        unit: units.flow,
        rampName: "Teal",
        mode: "equalQuantiles",
        absValues: true,
        sortedData,
      });
      return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
    },

  velocity:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): LinkSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "velocity");
      const colorRule = initializeColorRule({
        property: "velocity",
        unit: units.velocity,
        rampName: "RedOr",
        mode: "prettyBreaks",
        sortedData,
        fallbackEndpoints: getFallbackEndpoints(
          units.velocity,
          VELOCITY_FALLBACK_ENDPOINTS,
        ),
      });
      return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
    },

  unitHeadloss:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): LinkSymbology => {
      const sortedData = getSortedSimulationValues(
        resultsReader,
        "unitHeadloss",
      );
      const colorRule = initializeColorRule({
        property: "unitHeadloss",
        unit: units.unitHeadloss,
        rampName: "Emrld",
        mode: "prettyBreaks",
        sortedData,
        fallbackEndpoints: getFallbackEndpoints(
          units.unitHeadloss,
          UNIT_HEADLOSS_FALLBACK_ENDPOINTS,
        ),
      });
      return { ...nullSymbologySpec.link, colorRule, labelRule: nullLabelRule };
    },

  pressure:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): NodeSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "pressure");
      const colorRule = initializeColorRule({
        property: "pressure",
        unit: units.pressure,
        rampName: "Temps",
        mode: "prettyBreaks",
        fallbackEndpoints: [0, 100],
        sortedData,
      });
      return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
    },

  actualDemand:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): NodeSymbology => {
      const sortedData = getSortedSimulationValues(
        resultsReader,
        "actualDemand",
      );
      const colorRule = initializeColorRule({
        property: "actualDemand",
        unit: units.actualDemand,
        rampName: "Emrld",
        mode: "prettyBreaks",
        fallbackEndpoints: [0, 100],
        sortedData,
      });
      return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
    },

  head:
    (
      hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): NodeSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "head");
      const colorRule = initializeColorRule({
        property: "head",
        unit: units.head,
        rampName: "Purp",
        mode: "prettyBreaks",
        fallbackEndpoints: [0, 100],
        sortedData,
      });
      return { ...nullSymbologySpec.node, colorRule, labelRule: nullLabelRule };
    },

  waterAge:
    (
      _hydraulicModel: HydraulicModel,
      units: UnitsSpec,
      resultsReader: ResultsReader,
    ) =>
    (): NodeSymbology & LinkSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "waterAge");
      const colorRule = initializeColorRule({
        property: "waterAge",
        unit: units.waterAge,
        rampName: "Temps",
        mode: "prettyBreaks",
        fallbackEndpoints: [0, 48],
        sortedData,
      });
      return {
        colorRule,
        labelRule: nullLabelRule,
        defaults: nullSymbologySpec.node.defaults,
      };
    },
};
