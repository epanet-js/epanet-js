import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useZoneImportReset } from "src/hooks/persistence/use-zone-import-reset";
import type { ZoneFeature } from "src/commands/read-zone-features";
import type { HydraulicModel } from "src/hydraulic-model";
import { buildZonesFromFeatures } from "src/hydraulic-model/utilities/build-zones-from-features";
import { setZones } from "src/hydraulic-model/mutations/set-zones";

export const applyZoneImport = (
  hydraulicModel: HydraulicModel,
  features: ZoneFeature[],
  labelProperty: string | undefined,
): HydraulicModel => {
  const zones = buildZonesFromFeatures(features, labelProperty);
  return setZones(hydraulicModel, zones);
};

export const useApplyZoneImport = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { zoneImportReset } = useZoneImportReset();

  return useCallback(
    (features: ZoneFeature[], labelProperty: string | undefined) => {
      const updatedModel = applyZoneImport(
        hydraulicModel,
        features,
        labelProperty,
      );
      zoneImportReset({ hydraulicModel: updatedModel });
    },
    [hydraulicModel, zoneImportReset],
  );
};
