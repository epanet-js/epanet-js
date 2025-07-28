import { HydraulicModel } from "src/hydraulic-model";
import { Quantities } from "src/model-metadata/quantities-spec";
import { initializeColorRule } from "./range-color-rule";
import { NodeSymbology, LinkSymbology } from "./symbology-types";
import { nullLabelRule } from "./labeling";
import { getSortedValues } from "src/hydraulic-model/assets-map";

type DefaultSymbologyBuilders = {
  flow: (hydraulicModel: HydraulicModel) => () => LinkSymbology;
  diameter: (hydraulicModel: HydraulicModel) => () => LinkSymbology;
  roughness: (hydraulicModel: HydraulicModel) => () => LinkSymbology;
  unitHeadloss: (
    hydraulicModel: HydraulicModel,
    quantities: Quantities,
  ) => () => LinkSymbology;
  velocity: (
    hydraulicModel: HydraulicModel,
    quantities: Quantities,
  ) => () => LinkSymbology;
  pressure: (hydraulicModel: HydraulicModel) => () => NodeSymbology;
  elevation: (HydraulicModel: HydraulicModel) => () => NodeSymbology;
  head: (HydraulicModel: HydraulicModel) => () => NodeSymbology;
  none: () => () => { colorRule: null; labelRule: null };
};

export const defaultSymbologyBuilders: DefaultSymbologyBuilders = {
  none: () => () => {
    return { colorRule: null, labelRule: null };
  },
  diameter: (hydraulicModel: HydraulicModel) => (): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "diameter",
      unit: hydraulicModel.units.diameter,
      rampName: "SunsetDark",
      mode: "prettyBreaks",
      numIntervals: 7,
      sortedData: getSortedValues(hydraulicModel.assets, "diameter"),
    });
    return { colorRule, labelRule: nullLabelRule };
  },

  roughness: (hydraulicModel: HydraulicModel) => (): LinkSymbology => {
    const colorRule = initializeColorRule({
      property: "roughness",
      unit: hydraulicModel.units.roughness,
      rampName: "Emrld",
      mode: "prettyBreaks",
      sortedData: getSortedValues(hydraulicModel.assets, "roughness"),
    });
    return { colorRule, labelRule: nullLabelRule };
  },

  flow: (hydraulicModel: HydraulicModel): (() => LinkSymbology) => {
    return (): LinkSymbology => {
      const property = "flow";
      const sortedData = getSortedValues(hydraulicModel.assets, "flow", {
        absValues: true,
      });
      const colorRule = initializeColorRule({
        property,
        unit: hydraulicModel.units.flow,
        rampName: "Teal",
        mode: "equalQuantiles",
        absValues: true,
        sortedData,
      });
      return { colorRule, labelRule: nullLabelRule };
    };
  },
  velocity:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinkSymbology => {
      const colorRule = initializeColorRule({
        property: "velocity",
        unit: hydraulicModel.units.velocity,
        rampName: "RedOr",
        mode: "prettyBreaks",
        sortedData: getSortedValues(hydraulicModel.assets, "velocity"),
        fallbackEndpoints: quantities.ranges.velocityFallbackEndpoints,
      });
      return { colorRule, labelRule: nullLabelRule };
    },
  unitHeadloss:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinkSymbology => {
      const colorRule = initializeColorRule({
        property: "unitHeadloss",
        unit: hydraulicModel.units.unitHeadloss,
        rampName: "Emrld",
        mode: "prettyBreaks",
        sortedData: getSortedValues(hydraulicModel.assets, "unitHeadloss"),
        fallbackEndpoints: quantities.ranges.unitHeadlossFallbackEndpoints,
      });
      return { colorRule, labelRule: nullLabelRule };
    },
  pressure: (hydraulicModel: HydraulicModel) => (): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "pressure",
      unit: hydraulicModel.units.pressure,
      rampName: "Temps",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "pressure"),
    });
    return { colorRule, labelRule: nullLabelRule };
  },
  elevation: (hydraulicModel: HydraulicModel) => (): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "elevation",
      unit: hydraulicModel.units.elevation,
      rampName: "Fall",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
    });
    return { colorRule, labelRule: nullLabelRule };
  },
  head: (hydraulicModel: HydraulicModel) => (): NodeSymbology => {
    const colorRule = initializeColorRule({
      property: "head",
      unit: hydraulicModel.units.head,
      rampName: "Purp",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "head"),
    });
    return { colorRule, labelRule: nullLabelRule };
  },
};
