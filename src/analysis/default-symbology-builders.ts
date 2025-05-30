import { HydraulicModel } from "src/hydraulic-model";
import { Quantities } from "src/model-metadata/quantities-spec";
import { initializeColorRule } from "./range-color-rule";
import { getSortedValues } from "./analysis-data";
import { LabelRule, NodeSymbology, LinkSymbology } from "./symbology-types";
import { nullLabelRule } from "./labeling";

type DefaultSymbologyBuilders = {
  flow: (hydraulicModel: HydraulicModel) => () => LinkSymbology;
  diameter: (hydraulicModel: HydraulicModel) => () => LinkSymbology;
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
  none: () => () => { type: "none"; labelRule: LabelRule };
};

export const defaultSymbologyBuilders: DefaultSymbologyBuilders = {
  none: () => () => {
    return { type: "none", labelRule: nullLabelRule };
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
    return { type: "diameter", colorRule, labelRule: nullLabelRule };
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
      return { type: "flow", colorRule, labelRule: nullLabelRule };
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
        fallbackEndpoints: quantities.analysis.velocityFallbackEndpoints,
      });
      return { type: "velocity", colorRule, labelRule: nullLabelRule };
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
        fallbackEndpoints: quantities.analysis.unitHeadlossFallbackEndpoints,
      });
      return { type: "unitHeadloss", colorRule, labelRule: nullLabelRule };
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
    return { type: "pressure", colorRule, labelRule: nullLabelRule };
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
    return { type: "elevation", colorRule, labelRule: nullLabelRule };
  },
};
