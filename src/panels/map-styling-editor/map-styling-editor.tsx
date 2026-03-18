import { useAtomValue, useSetAtom } from "jotai";
import * as Popover from "@radix-ui/react-popover";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { showGridAtom } from "src/state/map-projection";
import { simulationAtom, simulationResultsAtom } from "src/state/simulation";
import { Selector, SelectorLikeButton } from "src/components/form/selector";
import { useUserTracking } from "src/infra/user-tracking";
import {
  SupportedProperty,
  nullSymbologySpec,
  supportedLinkProperties,
  supportedNodeProperties,
} from "src/map/symbology/symbology-types";
import { useSymbologyState } from "src/state/map-symbology";
import { defaultSymbologyBuilders } from "src/map/symbology/default-symbology-builders";
import { Checkbox } from "src/components/form/Checkbox";
import { ColorRampSelector } from "src/components/color-ramp-selector";
import { RangeColorRuleEditor } from "./range-color-rule-editor";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
  Button,
} from "src/components/elements";
import { RangeMode } from "src/map/symbology/range-color-rule";
import { AddLayer, LayersEditor } from "./layers-editor";
import { InlineField, Section, SectionList } from "src/components/form/fields";
import { ColorPopover } from "src/components/color-popover";
import {
  Draggable,
  DeleteIcon,
  AddIcon,
  LocateOffIcon,
  MultipleValuesIcon,
} from "src/icons";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { LegendRamp } from "src/components/legends";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection/selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

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
  const isDtmElevationsOn = useFeatureFlag("FLAG_DTM_ELEVATIONS");

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
        <CustomerPointsSection />
        {isDtmElevationsOn && <ElevationsSection />}
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
    updateNodeSymbology,
    updateLinkSymbology,
    switchNodeSymbologyTo,
    switchLinkSymbologyTo,
    updateNodeDefaultColor,
    updateLinkDefaultColor,
  } = useSymbologyState();
  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const { units } = useAtomValue(projectSettingsAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);

  const userTracking = useUserTracking();

  const handleColorByChange = (property: SelectOption) => {
    userTracking.capture({
      name: "map.colorBy.changed",
      type: geometryType,
      subtype: property,
    });

    const isSimulationProperty = simulationProperties.includes(property);
    const canApplySymbology = !isSimulationProperty || simulationResults;

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

  const defaultColor = symbology.defaults.color;
  const handleDefaultColorChange =
    geometryType === "node" ? updateNodeDefaultColor : updateLinkDefaultColor;

  const isDefaultColorOn = useFeatureFlag("FLAG_MAP_DEFAULT_COLOR");

  return (
    <Section title={title}>
      {isDefaultColorOn && (
        <InlineField
          name={translate("defaultColor")}
          labelSize="sm"
          layout="fixed-label"
        >
          <div className="h-7 w-12 rounded overflow-hidden">
            <ColorPopover
              color={defaultColor}
              onChange={handleDefaultColorChange}
              ariaLabel={`Default ${geometryType} color`}
            />
          </div>
        </InlineField>
      )}
      <InlineField
        name={translate("colorBy")}
        labelSize="sm"
        layout="fixed-label"
      >
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
              <InlineField
                name={translate("range")}
                labelSize="sm"
                layout="fixed-label"
              >
                <RangeColorRuleEditorTrigger
                  mode={symbology.colorRule.mode}
                  numIntervals={symbology.colorRule.breaks.length + 1}
                  geometryType={geometryType}
                />
              </InlineField>
              <InlineField
                name={translate("ramp")}
                labelSize="sm"
                layout="fixed-label"
              >
                <ColorRampSelector geometryType={geometryType} />
              </InlineField>
            </>
          )}
          {!isSmOrLarger && (
            <InlineField
              name="Legend"
              align="start"
              labelSize="sm"
              layout="fixed-label"
            >
              <div className="w-full px-2">
                <LegendRamp colorRule={symbology.colorRule} />
              </div>
            </InlineField>
          )}
          <InlineField
            name={translate("labels")}
            labelSize="sm"
            layout="fixed-label"
          >
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
      <InlineField
        name={translate("visible")}
        labelSize="sm"
        layout="fixed-label"
      >
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

const ElevationsSection = () => {
  const translate = useTranslate();

  return (
    <Section title={translate("elevations")}>
      <div className="flex flex-col gap-y-1">
        <GeoTiffElevationSourceRow />
        <GlobalDtmElevationSourceRow />
        <Button variant="default" size="sm" className="w-full justify-center">
          <AddIcon size="sm" />
          {translate("addNewElevationData")}
        </Button>
      </div>
    </Section>
  );
};

const ElevationSourceRowShell = ({
  name,
  typeLabel,
  children,
}: {
  name: string;
  typeLabel: string;
  children: React.ReactNode;
}) => (
  <div className="py-2 flex gap-x-2 items-start">
    <div className="pt-0.5 opacity-20 hover:opacity-100 cursor-ns-resize">
      <Draggable />
    </div>
    <div className="flex-auto">
      <div className="flex gap-x-2 items-center">
        <span className="block select-none truncate flex-auto text-sm">
          {name}
        </span>
        {children}
      </div>
      <div className="opacity-50 font-semibold" style={{ fontSize: 10 }}>
        {typeLabel}
      </div>
    </div>
  </div>
);

const GeoTiffElevationSourceRow = () => {
  const translate = useTranslate();
  return (
    <ElevationSourceRowShell
      name={translate("userElevationData")}
      typeLabel="GEOTIFF"
    >
      <button className="opacity-30 hover:opacity-100 select-none">
        <MultipleValuesIcon />
      </button>
      <button className="opacity-50 hover:opacity-100 select-none text-red-500">
        <DeleteIcon />
      </button>
    </ElevationSourceRowShell>
  );
};

const GlobalDtmElevationSourceRow = () => {
  const translate = useTranslate();
  return (
    <ElevationSourceRowShell
      name={translate("mapboxDefaultData")}
      typeLabel={translate("globalDtm").toUpperCase()}
    >
      <button className="opacity-30 hover:opacity-100 select-none">
        <LocateOffIcon />
      </button>
    </ElevationSourceRowShell>
  );
};
