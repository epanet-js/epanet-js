import { HydraulicModel } from "src/hydraulic-model";
import { Quantities } from "src/model-metadata/quantities-spec";
import { initializeColorRule } from "./range-color-rule";
import { NodeSymbology, LinkSymbology } from "./symbology-types";
import { nullLabelRule } from "./labeling";
import { getSortedValues } from "src/hydraulic-model/assets-map";
import {
  getSortedSimulationValues,
  type ResultsReader,
} from "src/simulation/results-reader";
import type { RangeColorPreference } from "src/state/map-symbology";
import type { RangeColorRule } from "./range-color-rule";

const applyCustomColors = (
  colorRule: RangeColorRule,
  preference?: RangeColorPreference,
): RangeColorRule => {
  if (
    preference?.customColors &&
    preference.customColors.length === colorRule.colors.length
  ) {
    return { ...colorRule, colors: preference.customColors };
  }
  return colorRule;
};

type SymbologyBuilderFn<T> = (
  hydraulicModel: HydraulicModel,
  quantities: Quantities,
  resultsReader: ResultsReader,
  preference?: RangeColorPreference,
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
  none: () => () => { colorRule: null; labelRule: null };
};

export const defaultSymbologyBuilders: DefaultSymbologyBuilders = {
  none: () => () => {
    return { colorRule: null, labelRule: null };
  },

  diameter:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      _resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): LinkSymbology => {
      const colorRule = initializeColorRule({
        property: "diameter",
        unit: hydraulicModel.units.diameter,
        rampName: preference?.rampName ?? "SunsetDark",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals ?? 7,
        reverseRamp: preference?.reversedRamp,
        sortedData: getSortedValues(hydraulicModel.assets, "diameter"),
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  roughness:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      _resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): LinkSymbology => {
      const colorRule = initializeColorRule({
        property: "roughness",
        unit: hydraulicModel.units.roughness,
        rampName: preference?.rampName ?? "Emrld",
        mode: preference?.mode ?? "ckmeans",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        sortedData: getSortedValues(hydraulicModel.assets, "roughness"),
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  elevation:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      _resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): NodeSymbology => {
      const colorRule = initializeColorRule({
        property: "elevation",
        unit: hydraulicModel.units.elevation,
        rampName: preference?.rampName ?? "Fall",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        fallbackEndpoints: [0, 100],
        sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  flow:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): LinkSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "flow", {
        absValues: true,
      });
      const colorRule = initializeColorRule({
        property: "flow",
        unit: hydraulicModel.units.flow,
        rampName: preference?.rampName ?? "Teal",
        mode: preference?.mode ?? "equalQuantiles",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        absValues: true,
        sortedData,
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  velocity:
    (
      hydraulicModel: HydraulicModel,
      quantities: Quantities,
      resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): LinkSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "velocity");
      const colorRule = initializeColorRule({
        property: "velocity",
        unit: hydraulicModel.units.velocity,
        rampName: preference?.rampName ?? "RedOr",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        sortedData,
        fallbackEndpoints: quantities.ranges.velocityFallbackEndpoints,
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  unitHeadloss:
    (
      hydraulicModel: HydraulicModel,
      quantities: Quantities,
      resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): LinkSymbology => {
      const sortedData = getSortedSimulationValues(
        resultsReader,
        "unitHeadloss",
      );
      const colorRule = initializeColorRule({
        property: "unitHeadloss",
        unit: hydraulicModel.units.unitHeadloss,
        rampName: preference?.rampName ?? "Emrld",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        sortedData,
        fallbackEndpoints: quantities.ranges.unitHeadlossFallbackEndpoints,
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  pressure:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): NodeSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "pressure");
      const colorRule = initializeColorRule({
        property: "pressure",
        unit: hydraulicModel.units.pressure,
        rampName: preference?.rampName ?? "Temps",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        fallbackEndpoints: [0, 100],
        sortedData,
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  actualDemand:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): NodeSymbology => {
      const sortedData = getSortedSimulationValues(
        resultsReader,
        "actualDemand",
      );
      const colorRule = initializeColorRule({
        property: "actualDemand",
        unit: hydraulicModel.units.actualDemand,
        rampName: preference?.rampName ?? "Emrld",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        fallbackEndpoints: [0, 100],
        sortedData,
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },

  head:
    (
      hydraulicModel: HydraulicModel,
      _quantities: Quantities,
      resultsReader: ResultsReader,
      preference?: RangeColorPreference,
    ) =>
    (): NodeSymbology => {
      const sortedData = getSortedSimulationValues(resultsReader, "head");
      const colorRule = initializeColorRule({
        property: "head",
        unit: hydraulicModel.units.head,
        rampName: preference?.rampName ?? "Purp",
        mode: preference?.mode ?? "prettyBreaks",
        numIntervals: preference?.numIntervals,
        reverseRamp: preference?.reversedRamp,
        fallbackEndpoints: [0, 100],
        sortedData,
      });
      return {
        colorRule: applyCustomColors(colorRule, preference),
        labelRule: nullLabelRule,
      };
    },
};
