import { useAtomValue } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { dataAtom, simulationAtom } from "src/state/jotai";
import { Selector, SelectorLikeButton } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import {
  SupportedProperty,
  nullSymbologySpec,
  supportedLinkProperties,
  supportedNodeProperties,
} from "src/map/symbology/symbology-types";
import { useSymbologyState } from "src/state/symbology";
import { defaultSymbologyBuilders } from "src/map/symbology/default-symbology-builders";
import { Checkbox } from "../form/Checkbox";
import { ColorRampSelector } from "src/components/color-ramp-selector";
import { RangeColorRuleEditor } from "../range-color-rule-editor";
import { StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { RangeMode } from "src/map/symbology/range-color-rule";
import { AddLayer, LayersEditor } from "../layers/layers-editor";
import { FieldList, InlineField } from "../form/fields";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { LegendRamp } from "../legends";

const colorPropertyLabelFor = (
  property: string,
  translate: (key: string) => string,
) => {
  if (property === "flow") {
    return translate("flowAbs");
  } else {
    return translate(property);
  }
};

export const MapStylingEditor = () => {
  const translate = useTranslate();

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar">
      <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-900 border-gray-200 dark:border-gray-900">
        <SymbologyEditor
          geometryType="node"
          properties={supportedNodeProperties}
        />
        <SymbologyEditor
          geometryType="link"
          properties={supportedLinkProperties}
        />
        <PanelSection title={translate("layers")} button={<AddLayer />}>
          <LayersEditor />
        </PanelSection>
      </div>
    </div>
  );
};

const simulationProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "pressure",
  "head",
];

type SelectOption = SupportedProperty | "none";

const SymbologyEditor = ({
  geometryType,
  properties,
}: {
  geometryType: "node" | "link";
  properties: readonly SupportedProperty[];
}) => {
  const translate = useTranslate();
  const translateUnit = useTranslateUnit();
  const simulation = useAtomValue(simulationAtom);

  const {
    linkSymbology,
    nodeSymbology,
    updateNodeSymbology,
    updateLinkSymbology,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
  } = useSymbologyState();
  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const {
    hydraulicModel,
    modelMetadata: { quantities },
  } = useAtomValue(dataAtom);

  const userTracking = useUserTracking();

  const handleColorByChange = (property: SelectOption) => {
    userTracking.capture({
      name: "map.colorBy.changed",
      type: geometryType,
      subtype: property,
    });

    if (geometryType === "node") {
      if (property === "none") {
        switchNodeSymbologyTo(null, () => nullSymbologySpec.node);
        return;
      }

      switchNodeSymbologyTo(
        property,
        defaultSymbologyBuilders[property](hydraulicModel, quantities),
      );
    } else {
      if (property === "none") {
        switchLinkSymbologyTo(null, () => nullSymbologySpec.link);
        return;
      }

      switchLinkSymbologyTo(
        property,
        defaultSymbologyBuilders[property](hydraulicModel, quantities),
      );
    }
  };

  const handleLabelRuleChange = (label: string | null) => {
    if (label !== null) {
      userTracking.capture({
        name: "map.labels.shown",
        type: geometryType,
        subtype: label,
      });
    }
    if (label === null) {
      userTracking.capture({
        name: "map.labels.hidden",
        type: geometryType,
      });
    }
    if (geometryType === "node") {
      updateNodeSymbology({ ...symbology, labelRule: label });
    } else {
      updateLinkSymbology({ ...symbology, labelRule: label });
    }
  };

  const title =
    geometryType === "node"
      ? translate("nodeSymbology")
      : translate("linkSymbology");

  const isSmOrLarger = useBreakpoint("sm");

  return (
    <PanelSection title={title}>
      <InlineField name={translate("colorBy")}>
        <Selector
          styleOptions={{ border: false }}
          ariaLabel={`${translate(geometryType)} ${translate("colorBy")}`}
          options={(["none", ...properties] as SelectOption[]).map((type) => {
            const unit = type !== "none" ? quantities.getUnit(type) : null;
            return {
              value: type,
              label: `${colorPropertyLabelFor(type, translate)} ${!!unit ? `(${translateUnit(unit)})` : ""}`,
              disabled:
                simulation.status === "idle" &&
                simulationProperties.includes(type),
            };
          })}
          selected={
            (symbology.colorRule
              ? symbology.colorRule.property
              : "none") as SelectOption
          }
          onChange={handleColorByChange}
        />
      </InlineField>
      {symbology.colorRule !== null && (
        <>
          {isSmOrLarger && (
            <>
              <InlineField name={translate("range")}>
                <RangeColorRuleEditorTrigger
                  mode={symbology.colorRule.mode}
                  numIntervals={symbology.colorRule.breaks.length + 1}
                  geometryType={geometryType}
                />
              </InlineField>
              <InlineField name={translate("ramp")}>
                <ColorRampSelector geometryType={geometryType} />
              </InlineField>
            </>
          )}
          {!isSmOrLarger && (
            <InlineField name="Legend" align="start">
              <div className="w-full px-2">
                <LegendRamp colorRule={symbology.colorRule} />
              </div>
            </InlineField>
          )}
          <InlineField name={translate("labels")}>
            <div className="p-2 flex items-center h-[38px]">
              <Checkbox
                checked={!!symbology.labelRule}
                aria-label={`${translate(geometryType)} ${translate("labels")}`}
                onChange={() =>
                  handleLabelRuleChange(
                    !!symbology.labelRule
                      ? null
                      : symbology.colorRule!.property,
                  )
                }
              />
            </div>
          </InlineField>
        </>
      )}
    </PanelSection>
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
      <FieldList>{children}</FieldList>
    </div>
  );
};

const RangeColorRuleEditorTrigger = ({
  geometryType,
  mode,
  numIntervals,
}: {
  geometryType: "node" | "link";
  mode: RangeMode;
  numIntervals: number;
}) => {
  const translate = useTranslate();

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
          <RangeColorRuleEditor geometryType={geometryType} />
        </StyledPopoverContent>
      </Popover.Portal>
    </Popover.Root>
  );
};
