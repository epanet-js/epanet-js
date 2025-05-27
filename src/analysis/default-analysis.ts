import { HydraulicModel } from "src/hydraulic-model";
import { Quantities } from "src/model-metadata/quantities-spec";
import { initializeSymbology } from "./range-symbology";
import { getSortedValues } from "./analysis-data";
import { Labeling, LinksAnalysis, NodesAnalysis } from "./analysis-types";
import { nullLabeling } from "./labeling";

type DefaultAnalysisBuilders = {
  flow: (hydraulicModel: HydraulicModel) => () => LinksAnalysis;
  diameter: (hydraulicModel: HydraulicModel) => () => LinksAnalysis;
  unitHeadloss: (
    hydraulicModel: HydraulicModel,
    quantities: Quantities,
  ) => () => LinksAnalysis;
  velocity: (
    hydraulicModel: HydraulicModel,
    quantities: Quantities,
  ) => () => LinksAnalysis;
  pressure: (hydraulicModel: HydraulicModel) => () => NodesAnalysis;
  elevation: (HydraulicModel: HydraulicModel) => () => NodesAnalysis;
  none: () => () => { type: "none"; labeling: Labeling };
};

export const defaultAnalysis: DefaultAnalysisBuilders = {
  none: () => () => {
    return { type: "none", labeling: nullLabeling };
  },
  diameter: (hydraulicModel: HydraulicModel) => (): LinksAnalysis => {
    const symbology = initializeSymbology({
      property: "diameter",
      unit: hydraulicModel.units.diameter,
      rampName: "SunsetDark",
      mode: "prettyBreaks",
      sortedData: getSortedValues(hydraulicModel.assets, "diameter"),
    });
    return { type: "diameter", symbology, labeling: nullLabeling };
  },

  flow: (hydraulicModel: HydraulicModel): (() => LinksAnalysis) => {
    return (): LinksAnalysis => {
      const property = "flow";
      const sortedData = getSortedValues(hydraulicModel.assets, "flow", {
        absValues: true,
      });
      const symbology = initializeSymbology({
        property,
        unit: hydraulicModel.units.flow,
        rampName: "Teal",
        mode: "equalQuantiles",
        absValues: true,
        sortedData,
      });
      return { type: "flow", symbology, labeling: nullLabeling };
    };
  },
  velocity:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinksAnalysis => {
      const symbology = initializeSymbology({
        property: "velocity",
        unit: hydraulicModel.units.velocity,
        rampName: "RedOr",
        mode: "prettyBreaks",
        sortedData: getSortedValues(hydraulicModel.assets, "velocity"),
        fallbackEndpoints: quantities.analysis.velocityFallbackEndpoints,
      });
      return { type: "velocity", symbology, labeling: nullLabeling };
    },
  unitHeadloss:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinksAnalysis => {
      const symbology = initializeSymbology({
        property: "unitHeadloss",
        unit: hydraulicModel.units.unitHeadloss,
        rampName: "Emrld",
        mode: "prettyBreaks",
        sortedData: getSortedValues(hydraulicModel.assets, "unitHeadloss"),
        fallbackEndpoints: quantities.analysis.unitHeadlossFallbackEndpoints,
      });
      return { type: "unitHeadloss", symbology, labeling: nullLabeling };
    },
  pressure: (hydraulicModel: HydraulicModel) => (): NodesAnalysis => {
    const symbology = initializeSymbology({
      property: "pressure",
      unit: hydraulicModel.units.pressure,
      rampName: "Temps",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "pressure"),
    });
    return { type: "pressure", symbology, labeling: nullLabeling };
  },
  elevation: (hydraulicModel: HydraulicModel) => (): NodesAnalysis => {
    const symbology = initializeSymbology({
      property: "elevation",
      unit: hydraulicModel.units.elevation,
      rampName: "Fall",
      mode: "prettyBreaks",
      fallbackEndpoints: [0, 100],
      sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
    });
    return { type: "elevation", symbology, labeling: nullLabeling };
  },
};
