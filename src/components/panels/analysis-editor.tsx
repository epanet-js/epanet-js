import { useAtom, useAtomValue } from "jotai";
import { PanelDetails } from "../panel_details";
import {
  linksAnalysisAtomDeprecated,
  nodesAnalysisAtomDeprecated,
} from "src/state/analysis-deprecated";
import { translate } from "src/infra/i18n";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { AnalysisType } from "src/analysis/analysis-types";
import { getSortedValues } from "src/analysis/analysis-data";
import { initializeSymbolization } from "src/analysis/symbolization-ramp";
import { isFeatureOn } from "src/infra/feature-flags";
import { useAnalysisSettings } from "src/state/analysis";
import { defaultAnalysis } from "src/analysis/default-analysis";

const analysisLabelFor = (type: AnalysisType) => {
  if (type === "flow") {
    return translate("flowAbs");
  } else {
    return translate(type);
  }
};

export const AnalysisEditor = () => {
  const [nodesDeprecated, setNodesAnalysisDeprecated] = useAtom(
    nodesAnalysisAtomDeprecated,
  );
  const [linksDeprecated, setLinksAnalysisDeprecated] = useAtom(
    linksAnalysisAtomDeprecated,
  );
  const { switchNodesAnalysisTo, switchLinksAnalysisTo } =
    useAnalysisSettings();
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

    if (type === "none") {
      return setLinksAnalysisDeprecated({ type: "none" });
    }
    if (isFeatureOn("FLAG_MEMORIZE")) {
      switchLinksAnalysisTo(
        type,
        defaultAnalysis[type](hydraulicModel, quantities),
      );
    } else {
      switch (type) {
        case "flow":
          return setLinksAnalysisDeprecated({
            type: "flow",
            symbolization: initializeSymbolization({
              property: "flow",
              unit: hydraulicModel.units.flow,
              rampName: "Teal",
              mode: "equalQuantiles",
              absValues: true,
              sortedData: getSortedValues(hydraulicModel.assets, "flow", {
                absValues: true,
              }),
            }),
          });
        case "velocity":
          return setLinksAnalysisDeprecated({
            type: "velocity",
            symbolization: initializeSymbolization({
              property: "velocity",
              unit: hydraulicModel.units.velocity,
              rampName: "RedOr",
              mode: "equalQuantiles",
              sortedData: getSortedValues(hydraulicModel.assets, "velocity"),
              fallbackEndpoints: quantities.analysis.velocityFallbackEndpoints,
            }),
          });
      }
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
        return setNodesAnalysisDeprecated({ type: "none" });
      case "pressure":
        return isFeatureOn("FLAG_MEMORIZE")
          ? switchNodesAnalysisTo(
              "pressure",
              defaultAnalysis.pressure(hydraulicModel),
            )
          : setNodesAnalysisDeprecated({
              type: "pressure",
              symbolization: initializeSymbolization({
                property: "pressure",
                unit: hydraulicModel.units.pressure,
                rampName: "Temps",
                mode: "prettyBreaks",
                fallbackEndpoints: [0, 100],
                sortedData: getSortedValues(hydraulicModel.assets, "pressure"),
              }),
            });
      case "elevation":
        return isFeatureOn("FLAG_MEMORIZE")
          ? switchNodesAnalysisTo(
              "elevation",
              defaultAnalysis.elevation(hydraulicModel),
            )
          : setNodesAnalysisDeprecated({
              type: "elevation",
              symbolization: initializeSymbolization({
                property: "elevation",
                unit: hydraulicModel.units.elevation,
                rampName: "Fall",
                mode: "prettyBreaks",
                fallbackEndpoints: [0, 100],
                sortedData: getSortedValues(hydraulicModel.assets, "elevation"),
              }),
            });
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
            selected={nodesDeprecated.type}
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
            selected={linksDeprecated.type}
            onChange={handleLinksChange}
          />
        </PanelDetails>
      </div>
    </div>
  );
};
