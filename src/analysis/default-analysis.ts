import { HydraulicModel } from "src/hydraulic-model";
import { Quantities } from "src/model-metadata/quantities-spec";
import { initializeSymbology } from "./range-symbology";
import { getSortedValues } from "./analysis-data";
import { LinksAnalysis, NodesAnalysis } from "./analysis-types";

type DefaultAnalysisBuilders = {
  flow: (hydraulicModel: HydraulicModel) => () => LinksAnalysis;
  velocity: (
    hydraulicModel: HydraulicModel,
    quantities: Quantities,
  ) => () => LinksAnalysis;
  pressure: (hydraulicModel: HydraulicModel) => () => NodesAnalysis;
  elevation: (HydraulicModel: HydraulicModel) => () => NodesAnalysis;
  none: () => () => { type: "none" };
};

export const defaultAnalysis: DefaultAnalysisBuilders = {
  none: () => () => ({ type: "none" }),
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
      return { type: "flow", symbology };
    };
  },
  velocity:
    (hydraulicModel: HydraulicModel, quantities: Quantities) =>
    (): LinksAnalysis => {
      const symbology = initializeSymbology({
        property: "velocity",
        unit: hydraulicModel.units.velocity,
        rampName: "RedOr",
        mode: "equalQuantiles",
        sortedData: getSortedValues(hydraulicModel.assets, "velocity"),
        fallbackEndpoints: quantities.analysis.velocityFallbackEndpoints,
      });
      return { type: "velocity", symbology };
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
    return { type: "pressure", symbology };
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
    return { type: "elevation", symbology };
  },
};
