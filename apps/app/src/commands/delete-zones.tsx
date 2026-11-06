import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { removeZones } from "@epanet-js/hydraulic-model-operations";
import { type ZoneId } from "@epanet-js/hydraulic-model";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const useDeleteZones = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();

  return useCallback(
    (zoneIds: ZoneId[], source: AssetDeleted["source"]) => {
      if (zoneIds.length === 0) return;

      userTracking.capture({
        name: "zones.deleted",
        count: zoneIds.length,
        source,
      });

      const selectedZoneIds = USelection.getZoneIds(selection);
      const removed = new Set(zoneIds);
      if (selectedZoneIds.some((id) => removed.has(id))) {
        setSelection(
          USelection.fromIds(
            USelection.getAssetIds(selection).slice(),
            USelection.getCustomerPointIds(selection).slice(),
            selectedZoneIds.filter((id) => !removed.has(id)),
          ),
        );
      }

      transact(() => removeZones(hydraulicModel, { zoneIds }));
    },
    [hydraulicModel, selection, setSelection, transact, userTracking],
  );
};
