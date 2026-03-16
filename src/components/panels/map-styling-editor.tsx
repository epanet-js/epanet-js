import { useAtomValue, useSetAtom } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { showGridAtom } from "src/state/map-projection";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { Selector, SelectorLikeButton } from "../form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import {
  SupportedProperty,
  nullSymbologySpec,
  supportedLinkProperties,
  supportedNodeProperties,
} from "src/map/symbology/symbology-types";
import { useSymbologyState } from "src/state/map-symbology";
import { defaultSymbologyBuilders } from "src/map/symbology/default-symbology-builders";
import { Checkbox } from "../form/Checkbox";
import { ColorRampSelector } from "src/components/color-ramp-selector";
import { RangeColorRuleEditor } from "../range-color-rule-editor";
import { StyledPopoverArrow, StyledPopoverContent } from "../elements";
import { RangeMode } from "src/map/symbology/range-color-rule";
import { AddLayer, LayersEditor } from "../layers/layers-editor";
import { InlineField, Section, SectionList } from "../form/fields";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { LegendRamp } from "../legends";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection/selection";

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
  const isGridOn = useAtomValue(showGridAtom);
  const isCreateCustomerOn = useFeatureFlag("FLAG_CREATE_CUSTOMER");

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar border-gray-200 dark:border-gray-900">
      <SectionList gap={1} padding={4}>
        <SymbologyEditor
          geometryType="node"
          properties={supportedNodeProperties}
        />
        <SymbologyEditor
          geometryType="link"
          properties={supportedLinkProperties}
        />
        {(!isGridOn || isCreateCustomerOn) && <CustomerPointsSection />}
        {!isGridOn && (
          <Section title={translate("layers")} button={<AddLayer />}>
            <LayersEditor />
          </Section>
        )}
      </SectionList>
    </div>
  );
};

const simulationProperties = [
  "flow",
  "velocity",
  "unitHeadloss",
  "pressure",
  "actualDemand",
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
  const simulationResults = useAtomValue(simulationResultsAtom);

  const {
    linkSymbology,
    nodeSymbology,
    symbologyPreferences,
    updateNodeSymbology,
    updateLinkSymbology,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
  } = useSymbologyState();
  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const { units } = useAtomValue(projectSettingsAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const isPersistMapPreferencesOn = useFeatureFlag(
    "FLAG_RESTORE_MAP_PREFERENCES",
  );

  const userTracking = useUserTracking();

  const handleColorByChange = (property: SelectOption) => {
    userTracking.capture({
      name: "map.colorBy.changed",
      type: geometryType,
      subtype: property,
    });

    const isSimulationProperty = simulationProperties.includes(property);
    const canApplySymbology = !isSimulationProperty || simulationResults;
    const preference =
      isPersistMapPreferencesOn && property !== "none"
        ? symbologyPreferences[property]
        : undefined;

    if (geometryType === "node") {
      if (property === "none") {
        switchNodeSymbologyTo(null, () => nullSymbologySpec.node);
        return;
      }

      if (canApplySymbology) {
        switchNodeSymbologyTo(
          property,
          defaultSymbologyBuilders[property](
            hydraulicModel,
            units,
            simulationResults!,
            preference,
          ),
        );
      }
    } else {
      if (property === "none") {
        switchLinkSymbologyTo(null, () => nullSymbologySpec.link);
        return;
      }

      if (canApplySymbology) {
        switchLinkSymbologyTo(
          property,
          defaultSymbologyBuilders[property](
            hydraulicModel,
            units,
            simulationResults!,
            preference,
          ),
        );
      }
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
    <Section title={title}>
      <InlineField name={translate("colorBy")} labelSize="md">
        <Selector
          ariaLabel={`${translate(geometryType)} ${translate("colorBy")}`}
          options={(["none", ...properties] as SelectOption[]).map((type) => {
            const unit = type !== "none" ? units[type] : null;
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
              <InlineField name={translate("range")} labelSize="md">
                <RangeColorRuleEditorTrigger
                  mode={symbology.colorRule.mode}
                  numIntervals={symbology.colorRule.breaks.length + 1}
                  geometryType={geometryType}
                />
              </InlineField>
              <InlineField name={translate("ramp")} labelSize="md">
                <ColorRampSelector geometryType={geometryType} />
              </InlineField>
            </>
          )}
          {!isSmOrLarger && (
            <InlineField name="Legend" align="start" labelSize="md">
              <div className="w-full px-2">
                <LegendRamp colorRule={symbology.colorRule} />
              </div>
            </InlineField>
          )}
          <InlineField name={translate("labels")} labelSize="md">
            <Checkbox
              checked={!!symbology.labelRule}
              aria-label={`${translate(geometryType)} ${translate("labels")}`}
              onChange={() =>
                handleLabelRuleChange(
                  !!symbology.labelRule ? null : symbology.colorRule!.property,
                )
              }
            />
          </InlineField>
        </>
      )}
    </Section>
  );
};

const CustomerPointsSection = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { customerPointsSymbology, updateCustomerPointsSymbology } =
    useSymbologyState();
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);

  const handleVisibilityChange = () => {
    const newVisibility = !customerPointsSymbology.visible;

    userTracking.capture({
      name: newVisibility
        ? "map.customerPoints.shown"
        : "map.customerPoints.hidden",
    });

    updateCustomerPointsSymbology({ visible: newVisibility });

    if (!newVisibility && selection.type === "singleCustomerPoint") {
      setSelection(USelection.none());
    }
  };

  return (
    <Section title={translate("customerPoints")}>
      <InlineField name={translate("visible")} labelSize="md">
        <Checkbox
          checked={customerPointsSymbology.visible}
          aria-label={`${translate("customerPoints")} ${translate("visible")}`}
          onChange={handleVisibilityChange}
        />
      </InlineField>
    </Section>
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
        <SelectorLikeButton>
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
