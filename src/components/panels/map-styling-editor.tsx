import { useAtomValue } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import { translate } from "src/infra/i18n";
import { LinkSymbology, NodeSymbology } from "src/analysis";
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
import { AddLayer, LayersEditor } from "../layers/layers-editor";

const analysisLabelFor = (type: AnalysisType) => {
  if (type === "flow") {
    return translate("flowAbs");
  } else {
    return translate(type);
  }
};

export const MapStylingEditor = () => {
  const {
    linksAnalysis,
    nodesAnalysis,
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
      name: "map.colorBy.changed",
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
    updateLinkSymbology({ ...linksAnalysis, labeling: label });
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
    updateNodeSymbology({ ...nodesAnalysis, labeling: label });
  };

  const handleNodesChange = (type: NodeSymbology["type"]) => {
    userTracking.capture({
      name: "map.colorBy.changed",
      type: "nodes",
      subtype: type,
    });

    switchNodeSymbologyTo(type, defaultAnalysis[type](hydraulicModel));
  };

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <PanelSection title={translate("nodeSymbology")}>
          <PanelItem name={translate("colorBy")}>
            <Selector
              styleOptions={{ border: false }}
              ariaLabel={`${translate("nodes")} ${translate("colorBy")}`}
              options={(
                ["none", "elevation", "pressure"] as NodeSymbology["type"][]
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
              <PanelItem name={translate("range")}>
                <RangeSymbologyEditorTrigger
                  mode={nodesAnalysis.symbology.mode}
                  numIntervals={nodesAnalysis.symbology.breaks.length + 1}
                  geometryType="node"
                />
              </PanelItem>
              <PanelItem name={translate("ramp")}>
                <ColorRampSelector geometryType="node" />
              </PanelItem>
              <PanelItem name={translate("labels")}>
                <div className="p-2 flex items-center h-[38px]">
                  <Checkbox
                    aria-label={`${translate("nodes")} ${translate("labels")}`}
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
        <PanelSection title={translate("linkSymbology")}>
          <PanelItem name={translate("colorBy")}>
            <Selector
              styleOptions={{ border: false }}
              ariaLabel={`${translate("links")} ${translate("colorBy")}`}
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
              selected={linksAnalysis.type}
              onChange={handleLinksChange}
            />
          </PanelItem>
          {linksAnalysis.type !== "none" && (
            <>
              <PanelItem name={translate("range")}>
                <RangeSymbologyEditorTrigger
                  mode={linksAnalysis.symbology.mode}
                  numIntervals={linksAnalysis.symbology.breaks.length + 1}
                  geometryType="link"
                />
              </PanelItem>
              <PanelItem name={translate("ramp")}>
                <ColorRampSelector geometryType="link" />
              </PanelItem>
              <PanelItem name={translate("labels")}>
                <div className="p-2 flex items-center h-[38px]">
                  <Checkbox
                    checked={!!linksAnalysis.labeling}
                    aria-label={`${translate("links")} ${translate("labels")}`}
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
            </>
          )}
        </PanelSection>
        <PanelSection title={translate("layers")} button={<AddLayer />}>
          <LayersEditor />
        </PanelSection>
      </div>
    </div>
  );
};

const PanelSection = ({
  title,
  button,
  children,
}: {
  title: string;
  button?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className="px-3 py-5">
      <div className="flex items-start justify-between text-sm font-bold text-gray-900 dark:text-white pb-3">
        {title}
        {button && button}
      </div>
      <div className="flex flex-col gap-y-2">{children}</div>
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
