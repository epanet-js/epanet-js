import { useAtomValue } from "jotai";
import { PanelDetails } from "../panel_details";
import { translate } from "src/infra/i18n";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { AnalysisType } from "src/analysis/analysis-types";
import { isFeatureOn } from "src/infra/feature-flags";
import { useAnalysisState } from "src/state/analysis";
import { defaultAnalysis } from "src/analysis/default-analysis";

const analysisLabelFor = (type: AnalysisType) => {
  if (type === "flow") {
    return translate("flowAbs");
  } else {
    return translate(type);
  }
};

export const AnalysisSettingsPanel = () => {
  const {
    linksAnalysis,
    nodesAnalysis,
    switchNodesAnalysisTo,
    switchLinksAnalysisTo,
  } = useAnalysisState();
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

    switchLinksAnalysisTo(
      type,
      defaultAnalysis[type](hydraulicModel, quantities),
    );
  };

  const handleNodesChange = (type: NodesAnalysis["type"]) => {
    userTracking.capture({
      name: "analysis.applied",
      type: "nodes",
      subtype: type,
    });

    switchNodesAnalysisTo(type, defaultAnalysis[type](hydraulicModel));
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
            selected={nodesAnalysis.type}
            onChange={handleNodesChange}
          />
        </PanelDetails>
        <PanelDetails title={translate("links")}>
          <Selector
            ariaLabel={translate("links")}
            options={(isFeatureOn("FLAG_UNIT_HEADLOSS")
              ? ([
                  "none",
                  "flow",
                  "velocity",
                  "unitHeadloss",
                ] as LinksAnalysis["type"][])
              : (["none", "flow", "velocity"] as LinksAnalysis["type"][])
            ).map((type) => ({
              value: type,
              label: analysisLabelFor(type),
              disabled:
                simulation.status === "idle" &&
                ["flow", "velocity", "unitHeadloss"].includes(type),
            }))}
            selected={linksAnalysis.type}
            onChange={handleLinksChange}
          />
        </PanelDetails>
      </div>
    </div>
  );
};
