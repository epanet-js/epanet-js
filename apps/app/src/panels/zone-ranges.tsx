import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { projectSettingsAtom } from "src/state/project-settings";
import { useSimulation } from "src/hooks/use-simulation";
import { useAsyncCompute } from "src/hooks/use-async-compute";
import { useTranslate } from "src/hooks/use-translate";
import { RingSpinner } from "src/components/ring-spinner";
import {
  elevationRange,
  pressureRange,
  queryZoneJunctionIds,
  type ValueRange,
} from "src/lib/zones/zone-ranges";
import { QuantityRow } from "./asset-panel/ui-components";

export const useZoneRanges = (zoneIds: readonly number[]) => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const simulation = useSimulation();
  const { data: junctionIds, isLoading } = useAsyncCompute(
    queryZoneJunctionIds,
    [hydraulicModel, zoneIds],
  );
  const elevations = useMemo(
    () => (junctionIds ? elevationRange(hydraulicModel, junctionIds) : null),
    [hydraulicModel, junctionIds],
  );
  const pressures = useMemo(
    () => (junctionIds ? pressureRange(simulation, junctionIds) : null),
    [simulation, junctionIds],
  );
  return {
    elevations,
    pressures,
    isPending: isLoading || junctionIds === null,
  };
};

export const ElevationRangeRows = ({ range }: { range: ValueRange | null }) => {
  const translate = useTranslate();
  const { units } = useAtomValue(projectSettingsAtom);
  return (
    <>
      <QuantityRow
        name="elevation"
        displayName={translate("minElevation")}
        value={range?.min ?? null}
        unit={units.elevation}
        readOnly={true}
        placeholder={translate("notAvailable")}
      />
      <QuantityRow
        name="elevation"
        displayName={translate("maxElevation")}
        value={range?.max ?? null}
        unit={units.elevation}
        readOnly={true}
        placeholder={translate("notAvailable")}
      />
    </>
  );
};

export const PressureRangeRows = ({ range }: { range: ValueRange | null }) => {
  const translate = useTranslate();
  const { units } = useAtomValue(projectSettingsAtom);
  return (
    <>
      <QuantityRow
        name="minPressure"
        value={range?.min ?? null}
        unit={units.pressure}
        readOnly={true}
        placeholder={translate("notAvailable")}
      />
      <QuantityRow
        name="maxPressure"
        value={range?.max ?? null}
        unit={units.pressure}
        readOnly={true}
        placeholder={translate("notAvailable")}
      />
    </>
  );
};

export const RangeLoader = () => (
  <div className="flex items-center justify-center py-4">
    <RingSpinner />
  </div>
);
