import { useMemo } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { isPlayingAtom } from "src/state/simulation-playback";
import * as Popover from "@radix-ui/react-popover";
import { useTranslate } from "src/hooks/use-translate";
import { useTranslateUnit } from "src/hooks/use-translate-unit";
import { projectSettingsAtom } from "src/state/project-settings";
import { showGridAtom } from "src/state/map-projection";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { Selector, SelectorLikeButton } from "@epanet-js/ui-kit";
import { useUserTracking } from "src/infra/user-tracking";
import {
  SupportedProperty,
  supportedLinkProperties,
  supportedNodeProperties,
  type ZoneLabelRule,
  type ZoneColorRule,
} from "src/map/symbology/symbology-types";
import { useSymbologyState } from "src/state/map-symbology";
import { useChangeColorBy } from "src/hooks/use-change-color-by";
import { Checkbox } from "src/components/form/Checkbox";
import { ColorRampSelector } from "src/components/color-ramp-selector";
import { RangeColorRuleEditor } from "./range-color-rule-editor";
import { NodeSizeField } from "./node-size-field";
import {
  StyledPopoverArrow,
  StyledPopoverContent,
} from "src/components/elements";
import { RangeMode } from "src/map/symbology/range-color-rule";
import { LayersEditor } from "./layers-editor";
import {
  CollapsibleSection,
  InlineField,
  SectionList,
} from "src/components/form/fields";
import {
  mapStylingPanelSectionsExpandedAtom,
  type MapStylingPanelSectionExpanded,
} from "src/state/layout";
import { ColorPopover } from "src/components/color-popover";
import { useBreakpoint } from "src/hooks/use-breakpoint";
import { LegendRamp } from "src/components/legends";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { ElevationsEditor } from "./elevations-editor";
import { ProjectionSection } from "./projection-section";
import { TextField } from "src/components/form/text-field";
import { zoneFeaturesAtom } from "src/state/zone-features";
import { usePermissions } from "src/hooks/use-permissions";

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

const MapStylingSectionWrapper = ({
  title,
  section,
  children,
}: {
  title: string;
  section: keyof MapStylingPanelSectionExpanded;
  children: React.ReactNode;
}) => {
  const [sections, setSections] = useAtom(mapStylingPanelSectionsExpandedAtom);
  return (
    <CollapsibleSection
      title={title}
      open={sections[section]}
      onOpenChange={(open) =>
        setSections((prev) => ({ ...prev, [section]: open }))
      }
      separator={false}
      variant="primary"
    >
      {children}
    </CollapsibleSection>
  );
};

export const MapStylingEditor = () => {
  const translate = useTranslate();
  const isGridOn = useAtomValue(showGridAtom);
  const isPlaying = useAtomValue(isPlayingAtom);
  const { canUseZones } = usePermissions();
  const zoneFeatures = useAtomValue(zoneFeaturesAtom);
  const showZoneSymbology = canUseZones && zoneFeatures.length > 0;

  return (
    <div className="flex-auto overflow-y-auto placemark-scrollbar ">
      <SectionList gap={1} padding={3}>
        <SymbologyEditor
          geometryType="node"
          properties={supportedNodeProperties}
        />
        <SymbologyEditor
          geometryType="link"
          properties={supportedLinkProperties}
        />
        {showZoneSymbology && <ZoneSymbologySection />}
        <CustomerPointsSection readonly={isPlaying} />
        {!isGridOn && <ElevationsEditor />}
        {!isGridOn && (
          <MapStylingSectionWrapper
            title={translate("layers")}
            section="layers"
          >
            <LayersEditor />
          </MapStylingSectionWrapper>
        )}
        <ProjectionSection />
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
  "waterAge",
];

type LabelSelectOption = SupportedProperty | null | "label";

const SymbologyEditor = ({
  geometryType,
  properties,
}: {
  geometryType: "node" | "link";
  properties: readonly SupportedProperty[];
}) => {
  const translate = useTranslate();
  const readonly = useAtomValue(isPlayingAtom);
  const translateUnit = useTranslateUnit();
  const simulation = useAtomValue(simulationDerivedAtom);
  const {
    linkSymbology,
    nodeSymbology,
    updateNodeSymbology,
    updateLinkSymbology,
    updateNodeDefaultColor,
    updateLinkDefaultColor,
  } = useSymbologyState();
  const symbology = geometryType === "node" ? nodeSymbology : linkSymbology;
  const hasCompletedSimulation =
    "epsResultsReader" in simulation && !!simulation.epsResultsReader;
  const isEpsSimulation =
    "epsResultsReader" in simulation &&
    (simulation.epsResultsReader?.timestepCount ?? 0) > 1;
  const hasWaterAge =
    hasCompletedSimulation &&
    simulation.epsResultsReader?.qualityType === "age";
  const hasWaterTrace =
    hasCompletedSimulation &&
    simulation.epsResultsReader?.qualityType === "trace";
  const hasChemical =
    hasCompletedSimulation &&
    simulation.epsResultsReader?.qualityType === "chemical";
  const { units } = useAtomValue(projectSettingsAtom);

  const { changeColorBy } = useChangeColorBy(geometryType);

  const colorByOptions = useMemo(() => {
    const unitKeyFor = (type: SupportedProperty): keyof typeof units => {
      if (type === "minPressure" || type === "maxPressure") return "pressure";
      return type as keyof typeof units;
    };
    return properties
      .map((type) => {
        const unit = units[unitKeyFor(type)] ?? null;
        const isSimProp = simulationProperties.includes(type);
        const label = `${colorPropertyLabelFor(type, translate)} ${unit ? `(${translateUnit(unit)})` : ""}`;
        return {
          value: type,
          label,
          disabled:
            (!hasCompletedSimulation && isSimProp) ||
            ((type === "minPressure" || type === "maxPressure") &&
              !isEpsSimulation) ||
            (type === "waterAge" && !hasWaterAge) ||
            (type === "waterTrace" && !hasWaterTrace) ||
            (type === "chemicalConcentration" && !hasChemical),
        };
      })
      .sort((a, b) => Number(a.disabled) - Number(b.disabled));
  }, [
    properties,
    units,
    translate,
    translateUnit,
    hasCompletedSimulation,
    isEpsSimulation,
    hasWaterAge,
    hasWaterTrace,
    hasChemical,
  ]);

  const labelByOptions = useMemo(() => {
    const labelOption = {
      value: "label" as LabelSelectOption,
      label: translate("label"),
      disabled: false,
    };
    return [labelOption, ...colorByOptions];
  }, [colorByOptions, translate]);

  const userTracking = useUserTracking();

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

  const section: keyof MapStylingPanelSectionExpanded =
    geometryType === "node" ? "nodeSymbology" : "linkSymbology";

  const isSmOrLarger = useBreakpoint("sm");

  const defaultColor = symbology.defaults.color;
  const updateDefaultColor =
    geometryType === "node" ? updateNodeDefaultColor : updateLinkDefaultColor;
  const handleDefaultColorChange = (color: string) => {
    userTracking.capture({
      name: "map.defaultColor.changed",
      type: geometryType,
    });
    updateDefaultColor(color);
  };

  return (
    <MapStylingSectionWrapper title={title} section={section}>
      <InlineField
        name={translate("colorBy")}
        labelSize="sm"
        layout="fixed-label"
      >
        {readonly ? (
          <TextField>
            {symbology.colorRule
              ? (colorByOptions.find(
                  (option) => option.value === symbology.colorRule!.property,
                )?.label ?? translate("none"))
              : translate("none")}
          </TextField>
        ) : (
          <Selector
            ariaLabel={`${translate(geometryType)} ${translate("colorBy")}`}
            options={
              colorByOptions as {
                value: SupportedProperty;
                label: string;
                disabled: boolean;
              }[]
            }
            selected={symbology.colorRule?.property ?? null}
            nullable
            placeholder={translate("none")}
            clearLabel={translate("none")}
            onChange={(v) => {
              void changeColorBy(v as SupportedProperty | null);
            }}
            disabled={readonly}
          />
        )}
      </InlineField>
      {symbology.colorRule !== null ? (
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
                  readonly={readonly}
                />
              </InlineField>
              <InlineField
                name={translate("ramp")}
                labelSize="sm"
                layout="fixed-label"
              >
                <ColorRampSelector
                  geometryType={geometryType}
                  readonly={readonly}
                />
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
        </>
      ) : (
        <InlineField
          name={translate("defaultColor")}
          labelSize="sm"
          layout="fixed-label"
        >
          <div className="h-7 w-12 rounded-sm overflow-hidden">
            <ColorPopover
              color={defaultColor}
              onChange={handleDefaultColorChange}
              ariaLabel={`Default ${geometryType} color`}
              readonly={readonly}
            />
          </div>
        </InlineField>
      )}
      {geometryType === "node" && <NodeSizeField readonly={readonly} />}
      <InlineField
        name={translate("labelBy")}
        labelSize="sm"
        layout="fixed-label"
      >
        {readonly ? (
          <TextField>
            {symbology.labelRule
              ? (labelByOptions.find(
                  (option) => option.value === symbology.labelRule,
                )?.label ?? translate("none"))
              : translate("none")}
          </TextField>
        ) : (
          <Selector
            ariaLabel={`${translate(geometryType)} ${translate("labelBy")}`}
            options={
              labelByOptions as {
                value: string;
                label: string;
                disabled: boolean;
              }[]
            }
            selected={symbology.labelRule ?? null}
            nullable
            placeholder={translate("none")}
            clearLabel={translate("none")}
            onChange={handleLabelRuleChange}
          />
        )}
      </InlineField>
    </MapStylingSectionWrapper>
  );
};

const CustomerPointsSection = ({ readonly }: { readonly?: boolean }) => {
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

    if (!newVisibility) {
      const assetIds = USelection.getAssetIds(selection);
      const customerPointIds = USelection.getCustomerPointIds(selection);
      if (customerPointIds.length > 0) {
        setSelection(USelection.fromIds(assetIds, []));
      }
    }
  };

  return (
    <MapStylingSectionWrapper
      title={translate("customerPoints")}
      section="customerPoints"
    >
      <InlineField
        name={translate("visible")}
        labelSize="sm"
        layout="fixed-label"
      >
        <Checkbox
          checked={customerPointsSymbology.visible}
          aria-label={`${translate("customerPoints")} ${translate("visible")}`}
          onChange={handleVisibilityChange}
          disabled={readonly}
        />
      </InlineField>
    </MapStylingSectionWrapper>
  );
};

const zoneRuleOptions = [{ label: "Label", value: "label" }];

const ZoneSymbologySection = () => {
  const translate = useTranslate();
  const userTracking = useUserTracking();
  const { zoneSymbology, updateZoneSymbology } = useSymbologyState();

  const handleLabelRuleChange = (value: string | null) => {
    const mapped = value === "none" ? null : value;
    userTracking.capture({
      name: "map.zonesLabelRule.changed",
      labelRule: mapped,
    });
    updateZoneSymbology({ labelRule: mapped as ZoneLabelRule });
  };
  const handleColorRuleChange = (value: string | null) => {
    const mapped = value === "none" ? null : value;
    userTracking.capture({
      name: "map.zonesColorRule.changed",
      colorRule: mapped,
    });
    updateZoneSymbology({ colorRule: mapped as ZoneColorRule });
  };

  const handleVisibilityChange = () => {
    const newVisible = !zoneSymbology.visible;
    userTracking.capture({
      name: "map.zonesVisibility.changed",
      visible: newVisible,
    });
    updateZoneSymbology({ visible: newVisible });
  };

  const handleDefaultColorChange = (color: string) => {
    userTracking.capture({ name: "map.zonesDefaultColor.changed", color });
    updateZoneSymbology({
      defaults: { ...zoneSymbology.defaults, color },
    });
  };

  return (
    <MapStylingSectionWrapper
      title={translate("zoneSymbology")}
      section="zoneSymbology"
    >
      <InlineField
        name={translate("visible")}
        labelSize="sm"
        layout="fixed-label"
      >
        <Checkbox
          checked={zoneSymbology.visible}
          aria-label={`${translate("zoneSymbology")} ${translate("visible")}`}
          onChange={handleVisibilityChange}
        />
      </InlineField>
      <InlineField
        name={translate("colorBy")}
        labelSize="sm"
        layout="fixed-label"
      >
        <Selector
          ariaLabel={`${translate("zoneSymbology")} ${translate("colorBy")}`}
          options={zoneRuleOptions}
          selected={zoneSymbology.colorRule ?? null}
          nullable
          placeholder={translate("none")}
          clearLabel={translate("none")}
          onChange={handleColorRuleChange}
        />
      </InlineField>
      {zoneSymbology.colorRule === "label" ? (
        <InlineField
          name={translate("palette")}
          labelSize="sm"
          layout="fixed-label"
        >
          <ColorRampSelector geometryType="zone" />
        </InlineField>
      ) : (
        <InlineField
          name={translate("defaultColor")}
          labelSize="sm"
          layout="fixed-label"
        >
          <div className="h-7 w-12 rounded-sm overflow-hidden">
            <ColorPopover
              color={zoneSymbology.defaults.color}
              onChange={handleDefaultColorChange}
              ariaLabel="Default zone color"
            />
          </div>
        </InlineField>
      )}
      <InlineField
        name={translate("labelBy")}
        labelSize="sm"
        layout="fixed-label"
      >
        <Selector
          ariaLabel={`${translate("zoneSymbology")} ${translate("labelBy")}`}
          options={zoneRuleOptions}
          selected={zoneSymbology.labelRule ?? null}
          nullable
          placeholder={translate("none")}
          clearLabel={translate("none")}
          onChange={handleLabelRuleChange}
        />
      </InlineField>
    </MapStylingSectionWrapper>
  );
};

const RangeColorRuleEditorTrigger = ({
  geometryType,
  mode,
  numIntervals,
  readonly,
}: {
  geometryType: "node" | "link";
  mode: RangeMode;
  numIntervals: number;
  readonly?: boolean;
}) => {
  const translate = useTranslate();

  return readonly ? (
    <TextField>
      {translate(mode)}, {numIntervals}
    </TextField>
  ) : (
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
