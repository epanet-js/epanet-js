import { useCallback, type ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  CollapsibleSection,
  Section,
  SectionList,
} from "src/components/form/fields";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { useSelection } from "src/selection";
import { selectionAtom } from "src/state/selection";
import { multiAssetPanelCollapseAtom } from "src/state/layout";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { SelectOnlyZonesButton } from "./select-only-button";
import { MultiZoneCustomAttributesSection } from "./multi-zone-custom-attributes-section";
import {
  ElevationRangeRows,
  PressureRangeRows,
  RangeLoader,
  useZoneRanges,
} from "../zone-ranges";

export function ZonePanelSection({
  zoneIds,
  showSelectOnly,
  readonly = false,
}: {
  zoneIds: readonly number[];
  showSelectOnly: boolean;
  readonly?: boolean;
}) {
  const translate = useTranslate();
  const [collapseState, setCollapseState] = useAtom(
    multiAssetPanelCollapseAtom,
  );
  const isZoneCustomAttributesOn = useFeatureFlag(
    "FLAG_ZONE_CUSTOM_ATTRIBUTES",
  );
  const selection = useAtomValue(selectionAtom);
  const { selectZones } = useSelection(selection);
  const userTracking = useUserTracking();

  const handleSelect = useCallback(
    (ids: number[], property: string) => {
      userTracking.capture({
        name: "selection.narrowedToPropertyValue",
        type: "zone",
        property,
        count: ids.length,
      });
      selectZones(ids);
    },
    [selectZones, userTracking],
  );

  return (
    <CollapsibleSection
      title={`${translate("zones")} (${zoneIds.length})`}
      open={collapseState.zone}
      onOpenChange={(open) =>
        setCollapseState((prev) => ({ ...prev, zone: open }))
      }
      action={
        showSelectOnly ? <SelectOnlyZonesButton zoneIds={zoneIds} /> : undefined
      }
    >
      <ZoneRanges
        key={zoneIds.join(",")}
        zoneIds={zoneIds}
        customAttributes={
          isZoneCustomAttributesOn && (
            <MultiZoneCustomAttributesSection
              zoneIds={zoneIds}
              readonly={readonly}
              onSelectZones={handleSelect}
            />
          )
        }
      />
    </CollapsibleSection>
  );
}

const ZoneRanges = ({
  zoneIds,
  customAttributes,
}: {
  zoneIds: readonly number[];
  customAttributes: ReactNode;
}) => {
  const translate = useTranslate();
  const simulationState = useAtomValue(simulationDerivedAtom);
  const hasSimulation = simulationState.status !== "idle";
  const { elevations, pressures, isPending } = useZoneRanges(zoneIds);

  if (isPending) return <RangeLoader />;

  return (
    <SectionList overflow={false}>
      <Section title={translate("modelAttributes")} variant="secondary">
        <ElevationRangeRows range={elevations} />
      </Section>
      {hasSimulation && (
        <Section title={translate("simulationResults")} variant="secondary">
          <PressureRangeRows range={pressures} />
        </Section>
      )}
      {customAttributes}
    </SectionList>
  );
};
