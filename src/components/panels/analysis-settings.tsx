import { useAtomValue } from "jotai";
import { PanelDetails } from "../panel_details";
import { translate } from "src/infra/i18n";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { AnalysisType } from "src/analysis/analysis-types";
import { useAnalysisState } from "src/state/analysis";
import { defaultAnalysis } from "src/analysis/default-analysis";
import { Checkbox } from "../form/Checkbox";
import { isFeatureOn } from "src/infra/feature-flags";

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
    updateLinksAnalysis,
    updateNodesAnalysis,
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

  const handleLinksLabelsChange = (label: string | null) => {
    if (label !== null) {
      userTracking.capture({
        name: "map.labels.shown",
        type: "links",
        subtype: label,
      });
    }
    if (label === null) {
      userTracking.capture({
        name: "map.labels.hidden",
        type: "links",
      });
    }
    updateLinksAnalysis({ ...linksAnalysis, labeling: label });
  };

  const handleNodesLabelingChange = (label: string | null) => {
    if (label !== null) {
      userTracking.capture({
        name: "map.labels.shown",
        type: "nodes",
        subtype: label,
      });
    }
    if (label === null) {
      userTracking.capture({
        name: "map.labels.hidden",
        type: "nodes",
      });
    }
    updateNodesAnalysis({ ...nodesAnalysis, labeling: label });
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
          {isFeatureOn("FLAG_LABELS") && nodesAnalysis.type !== "none" && (
            <div className="py-4 text-sm flex items-center gap-x-2 ">
              <Checkbox
                aria-label={translate("showLabels")}
                checked={!!nodesAnalysis.labeling}
                onChange={() =>
                  handleNodesLabelingChange(
                    !!nodesAnalysis.labeling
                      ? null
                      : nodesAnalysis.symbology.property,
                  )
                }
              />
              {translate("showLabels")}
            </div>
          )}
        </PanelDetails>
        <PanelDetails title={translate("links")}>
          <Selector
            ariaLabel={translate("links")}
            options={(isFeatureOn("FLAG_DIAMETER")
              ? ([
                  "none",
                  "diameter",
                  "flow",
                  "velocity",
                  "unitHeadloss",
                ] as LinksAnalysis["type"][])
              : ([
                  "none",
                  "flow",
                  "velocity",
                  "unitHeadloss",
                ] as LinksAnalysis["type"][])
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
          {isFeatureOn("FLAG_LABELS") && linksAnalysis.type !== "none" && (
            <div className="py-4 text-sm flex items-center gap-x-2 ">
              <Checkbox
                checked={!!linksAnalysis.labeling}
                aria-label={translate("showLabels")}
                onChange={() =>
                  handleLinksLabelsChange(
                    !!linksAnalysis.labeling
                      ? null
                      : linksAnalysis.symbology.property,
                  )
                }
              />
              {translate("showLabels")}
            </div>
          )}
        </PanelDetails>
      </div>
    </div>
  );
};
