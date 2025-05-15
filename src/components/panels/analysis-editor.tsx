import { useAtom, useAtomValue } from "jotai";
import { PanelDetails } from "../panel_details";
import { analysisAtom } from "src/state/analysis";
import { translate } from "src/infra/i18n";
import { RangeColorMapping } from "src/analysis/range-color-mapping";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { AnalysisType } from "src/analysis/analysis-types";
import { getSortedValues } from "src/analysis/analysis-data";
import { initializeSymbolization } from "src/analysis/symbolization-ramp";

const analysisLabelFor = (type: AnalysisType) => {
  if (type === "flow") {
    return translate("flowAbs");
  } else {
    return translate(type);
  }
};

export const AnalysisEditor = () => {
  const [analysis, setAnalysis] = useAtom(analysisAtom);
  const simulation = useAtomValue(simulationAtom);
  const {
    hydraulicModel,
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const userTracking = useUserTracking();

  const handleLinksChange = (type: LinksAnalysis["type"]) => {
    userTracking.capture({
      name: "analysis.applied",
      type: "links",
      subtype: type,
    });

    switch (type) {
      case "none":
        return setAnalysis((prev) => ({
          ...prev,
          links: { type: "none" },
        }));
      case "flow":
        return setAnalysis((prev) => ({
          ...prev,
          links: {
            type: "flow",
            rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
              initializeSymbolization({
                property: "flow",
                unit: hydraulicModel.units.flow,
                rampName: "Teal",
                mode: "equalQuantiles",
                absValues: true,
                sortedData: getSortedValues(hydraulicModel.assets, "flow", {
                  absValues: true,
                }),
              }),
            ),
          },
        }));
      case "velocity":
        return setAnalysis((prev) => ({
          ...prev,
          links: {
            type: "velocity",
            rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
              initializeSymbolization({
                property: "velocity",
                unit: hydraulicModel.units.velocity,
                rampName: "RedOr",
                mode: "equalQuantiles",
                sortedData: getSortedValues(hydraulicModel.assets, "velocity"),
                fallbackEndpoints:
                  quantities.analysis.velocityFallbackEndpoints,
              }),
            ),
          },
        }));
    }
  };

  const handleNodesChange = (type: NodesAnalysis["type"]) => {
    userTracking.capture({
      name: "analysis.applied",
      type: "nodes",
      subtype: type,
    });

    switch (type) {
      case "none":
        return setAnalysis((prev) => ({
          ...prev,
          nodes: { type },
        }));
      case "pressure":
        return setAnalysis((prev) => ({
          ...prev,
          nodes: {
            type: "pressure",
            rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
              initializeSymbolization({
                property: "pressure",
                unit: hydraulicModel.units.pressure,
                rampName: "Temps",
                mode: "prettyBreaks",
                fallbackEndpoints: [0, 100],
                sortedData: getSortedValues(hydraulicModel.assets, "pressure"),
              }),
            ),
          },
        }));
      case "elevation":
        return setAnalysis((prev) => ({
          ...prev,
          nodes: {
            type: "elevation",
            rangeColorMapping: RangeColorMapping.fromSymbolizationRamp(
              initializeSymbolization({
                property: "elevation",
                unit: hydraulicModel.units.elevation,
                rampName: "Fall",
                mode: "prettyBreaks",
                fallbackEndpoints: [0, 100],
                sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
              }),
            ),
          },
        }));
    }
  };

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <div className="p-3 space-y-2">
          <div className="text-sm font-bold dark:text-white">
            {translate("analysisSettings")}
          </div>
        </div>
        <PanelDetails title={translate("nodes")}>
          <Selector
            ariaLabel={translate("nodes")}
            options={(
              ["none", "elevation", "pressure"] as NodesAnalysis["type"][]
            ).map((type) => ({
              value: type,
              label: analysisLabelFor(type),
              disabled:
                simulation.status === "idle" && ["pressure"].includes(type),
            }))}
            selected={analysis.nodes.type}
            onChange={handleNodesChange}
          />
        </PanelDetails>
        <PanelDetails title={translate("links")}>
          <Selector
            ariaLabel={translate("links")}
            options={(
              ["none", "flow", "velocity"] as LinksAnalysis["type"][]
            ).map((type) => ({
              value: type,
              label: analysisLabelFor(type),
              disabled:
                simulation.status === "idle" &&
                ["flow", "velocity"].includes(type),
            }))}
            selected={analysis.links.type}
            onChange={handleLinksChange}
          />
        </PanelDetails>
      </div>
    </div>
  );
};
