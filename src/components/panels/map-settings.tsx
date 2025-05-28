import { useAtomValue } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import { translate } from "src/infra/i18n";
import { LinksAnalysis, NodesAnalysis } from "src/analysis";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector, SelectorLikeButton } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import { AnalysisType } from "src/analysis/analysis-types";
import { useAnalysisState } from "src/state/analysis";
import { defaultAnalysis } from "src/analysis/default-analysis";
import { Checkbox } from "../form/Checkbox";
import { ColorRampSelector } from "src/components/color-ramp-selector";
import { RangeSymbologyEditor } from "../range-symbology-editor";
import { StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { RangeMode } from "src/analysis/range-symbology";

const analysisLabelFor = (type: AnalysisType) => {
  if (type === "flow") {
    return translate("flowAbs");
  } else {
    return translate(type);
  }
};

export const MapSettingsPanel = () => {
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
      <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <PanelSection title="Nodes Symbology">
          <PanelItem name="Color by">
            <Selector
              styleOptions={{ border: false }}
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
          </PanelItem>
          {nodesAnalysis.type !== "none" && (
            <>
              <PanelItem name="Range">
                <RangeSymbologyEditorTrigger
                  mode={nodesAnalysis.symbology.mode}
                  numIntervals={nodesAnalysis.symbology.breaks.length + 1}
                  geometryType="node"
                />
              </PanelItem>
              <PanelItem name="Ramp">
                <ColorRampSelector geometryType="node" />
              </PanelItem>
              <PanelItem name="Labels">
                <div className="p-2 flex items-center h-[38px]">
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
                </div>
              </PanelItem>
            </>
          )}
        </PanelSection>
        <PanelSection title="Links Symbology">
          <PanelItem name="Color by">
            <Selector
              styleOptions={{ border: false }}
              ariaLabel={translate("links")}
              options={(
                [
                  "none",
                  "diameter",
                  "flow",
                  "velocity",
                  "unitHeadloss",
                ] as LinksAnalysis["type"][]
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
          </PanelItem>
          {linksAnalysis.type !== "none" && (
            <PanelItem name="Labels">
              <div className="px-2">
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
              </div>
            </PanelItem>
          )}
        </PanelSection>
      </div>
    </div>
  );
};

const PanelSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="px-3 py-5">
      <div className="text-sm font-bold text-gray-900 dark:text-white pb-3">
        {title}
      </div>
      <div className="flex flex-col gap-y-3">{children}</div>
    </div>
  );
};

const PanelItem = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="flex items-center space-x-4">
      <label className="max-w-[67px] w-full text-sm text-gray-500">
        {name}
      </label>

      <div className="flex-1">{children}</div>
    </div>
  );
};

const RangeSymbologyEditorTrigger = ({
  geometryType,
  mode,
  numIntervals,
}: {
  geometryType: "node" | "link";
  mode: RangeMode;
  numIntervals: number;
}) => {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <SelectorLikeButton styleOptions={{ border: false }}>
          {translate(mode)}, {numIntervals}
        </SelectorLikeButton>
      </Popover.Trigger>
      <Popover.Portal>
        <StyledPopoverContent
          size="sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="right"
          align="start"
          sideOffset={94}
        >
          <StyledPopoverArrow />
          <RangeSymbologyEditor geometryType={geometryType} />
        </StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
