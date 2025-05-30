import { useAtomValue } from "jotai";
import { PanelDetails } from "../panel_details";
import { translate } from "src/infra/i18n";
import { LinkSymbology, NodeSymbology } from "src/analysis";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { AnalysisType } from "src/analysis/analysis-types";
import { useAnalysisState } from "src/state/analysis";
import { defaultAnalysis } from "src/analysis/default-analysis";
import { Checkbox } from "../form/Checkbox";

const analysisLabelFor = (type: AnalysisType) => {
  if (type === "flow") {
    return translate("flowAbs");
  } else {
    return translate(type);
  }
};

export const AnalysisSettingsPanel = () => {
  const {
    linkSymbology,
    nodeSymbology,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
    updateLinkSymbology,
    updateNodeSymbology,
  } = useAnalysisState();
  const simulation = useAtomValue(simulationAtom);
  const {
    hydraulicModel,
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);
  const userTracking = useUserTracking();

  const handleLinksChange = (type: LinkSymbology["type"]) => {
    userTracking.capture({
      name: "analysis.applied",
      type: "links",
      subtype: type,
    });

    switchLinkSymbologyTo(
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
    updateLinkSymbology({ ...linkSymbology, labeling: label });
  };

  const handleNodesLabelRuleChange = (label: string | null) => {
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
    updateNodeSymbology({ ...nodeSymbology, labeling: label });
  };

  const handleNodesChange = (type: NodeSymbology["type"]) => {
    userTracking.capture({
      name: "analysis.applied",
      type: "nodes",
      subtype: type,
    });

    switchNodeSymbologyTo(type, defaultAnalysis[type](hydraulicModel));
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
              ["none", "elevation", "pressure"] as NodeSymbology["type"][]
            ).map((type) => ({
              value: type,
              label: analysisLabelFor(type),
              disabled:
                simulation.status === "idle" && ["pressure"].includes(type),
            }))}
            selected={nodeSymbology.type}
            onChange={handleNodesChange}
          />
          {nodeSymbology.type !== "none" && (
            <div className="py-4 text-sm flex items-center gap-x-2 ">
              <Checkbox
                aria-label={translate("showLabels")}
                checked={!!nodeSymbology.labeling}
                onChange={() =>
                  handleNodesLabelRuleChange(
                    !!nodeSymbology.labeling
                      ? null
                      : nodeSymbology.symbology.property,
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
            options={(
              [
                "none",
                "diameter",
                "flow",
                "velocity",
                "unitHeadloss",
              ] as LinkSymbology["type"][]
            ).map((type) => ({
              value: type,
              label: analysisLabelFor(type),
              disabled:
                simulation.status === "idle" &&
                ["flow", "velocity", "unitHeadloss"].includes(type),
            }))}
            selected={linkSymbology.type}
            onChange={handleLinksChange}
          />
          {linkSymbology.type !== "none" && (
            <div className="py-4 text-sm flex items-center gap-x-2 ">
              <Checkbox
                checked={!!linkSymbology.labeling}
                aria-label={translate("showLabels")}
                onChange={() =>
                  handleLinksLabelsChange(
                    !!linkSymbology.labeling
                      ? null
                      : linkSymbology.symbology.property,
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
