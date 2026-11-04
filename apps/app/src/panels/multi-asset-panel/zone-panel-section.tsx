import { useAtom, useAtomValue } from "jotai";
import {
  CollapsibleSection,
  Section,
  SectionList,
} from "src/components/form/fields";
import { useTranslate } from "src/hooks/use-translate";
import { multiAssetPanelCollapseAtom } from "src/state/layout";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { SelectOnlyZonesButton } from "./select-only-button";
import {
  ElevationRangeRows,
  PressureRangeRows,
  RangeLoader,
  useZoneRanges,
} from "../zone-ranges";

export function ZonePanelSection({
  zoneIds,
  showSelectOnly,
}: {
  zoneIds: readonly number[];
  showSelectOnly: boolean;
}) {
  const translate = useTranslate();
  const [collapseState, setCollapseState] = useAtom(
    multiAssetPanelCollapseAtom,
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
      <ZoneRanges key={zoneIds.join(",")} zoneIds={zoneIds} />
    </CollapsibleSection>
  );
}

const ZoneRanges = ({ zoneIds }: { zoneIds: readonly number[] }) => {
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
    </SectionList>
  );
};
