import { HydraulicModel } from "src/hydraulic-model";
import { Quantities } from "src/model-metadata/quantities-spec";
import { initializeSymbology } from "./range-symbology";
import { getSortedValues } from "./analysis-data";
import { LabelRule, NodeSymbology, LinkSymbology } from "./analysis-types";
import { nullLabelRule } from "./labeling";

type DefaultAnalysisBuilders = {
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
  none: () => () => { type: "none"; label: LabelRule };
};

export const defaultAnalysis: DefaultAnalysisBuilders = {
  none: () => () => {
    return { type: "none", label: nullLabelRule };
  },
  diameter: (hydraulicModel: HydraulicModel) => (): LinkSymbology => {
    const colorRule = initializeSymbology({
      property: "diameter",
      unit: hydraulicModel.units.diameter,
      rampName: "SunsetDark",
      mode: "prettyBreaks",
      numIntervals: 7,
      sortedData: getSortedValues(hydraulicModel.assets, "diameter"),
    });
    return { type: "diameter", colorRule, label: nullLabelRule };
  },

  flow: (hydraulicModel: HydraulicModel): (() => LinkSymbology) => {
    return (): LinkSymbology => {
      const property = "flow";
      const sortedData = getSortedValues(hydraulicModel.assets, "flow", {
        absValues: true,
      });
      const colorRule = initializeSymbology({
        property,
        unit: hydraulicModel.units.flow,
        rampName: "Teal",
        mode: "equalQuantiles",
        absValues: true,
        sortedData,
      });
      return { type: "flow", colorRule, label: nullLabelRule };
    };
  },
  velocity:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinkSymbology => {
      const colorRule = initializeSymbology({
        property: "velocity",
        unit: hydraulicModel.units.velocity,
        rampName: "RedOr",
        mode: "prettyBreaks",
        sortedData: getSortedValues(hydraulicModel.assets, "velocity"),
        fallbackEndpoints: quantities.analysis.velocityFallbackEndpoints,
      });
      return { type: "velocity", colorRule, label: nullLabelRule };
    },
  unitHeadloss:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinkSymbology => {
      const colorRule = initializeSymbology({
        property: "unitHeadloss",
        unit: hydraulicModel.units.unitHeadloss,
        rampName: "Emrld",
        mode: "prettyBreaks",
        sortedData: getSortedValues(hydraulicModel.assets, "unitHeadloss"),
        fallbackEndpoints: quantities.analysis.unitHeadlossFallbackEndpoints,
      });
      return { type: "unitHeadloss", colorRule, label: nullLabelRule };
    },
  pressure: (hydraulicModel: HydraulicModel) => (): NodeSymbology => {
    const colorRule = initializeSymbology({
      property: "pressure",
      unit: hydraulicModel.units.pressure,
      rampName: "Temps",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "pressure"),
    });
    return { type: "pressure", colorRule, label: nullLabelRule };
  },
  elevation: (hydraulicModel: HydraulicModel) => (): NodeSymbology => {
    const colorRule = initializeSymbology({
      property: "elevation",
      unit: hydraulicModel.units.elevation,
      rampName: "Fall",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
    });
    return { type: "elevation", colorRule, label: nullLabelRule };
  },
};
