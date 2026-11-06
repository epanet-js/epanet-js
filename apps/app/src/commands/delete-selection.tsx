import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  deleteAssets,
  mergeChangeSets,
  removeCustomerPoints,
  removeZones,
} from "@epanet-js/hydraulic-model-operations";
import type { ChangeSet } from "@epanet-js/change-set";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { ephemeralStateAtom } from "src/state/drawing";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelection = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const { transact } = useModelTransaction();
  const userTracking = useUserTracking();

  const clearSelection = useCallback(() => {
    setSelection(USelection.none());
    setMode({ mode: Mode.NONE });
    setEphemeralState({ type: "none" });
  }, [setSelection, setMode, setEphemeralState]);

  return useCallback(
    ({ source }: { source: AssetDeleted["source"] }) => {
      const assetIds = USelection.getAssetIds(selection);
      const customerPointIds = USelection.getCustomerPointIds(selection);
      const zoneIds = USelection.getZoneIds(selection);
      if (
        assetIds.length === 0 &&
        customerPointIds.length === 0 &&
        zoneIds.length === 0
      )
        return;

      clearSelection();

      const singleAsset =
        assetIds.length === 1 && customerPointIds.length === 0
          ? hydraulicModel.assets.get(assetIds[0])
          : undefined;
      if (singleAsset) {
        userTracking.capture({
          name: "asset.deleted",
          source,
          type: singleAsset.type,
        });
      } else if (assetIds.length > 0) {
        userTracking.capture({
          name: "assets.deleted",
          source,
          count: assetIds.length,
        });
      }
      if (customerPointIds.length > 0) {
        userTracking.capture({
          name: "customerPointActions.removed",
          count: customerPointIds.length,
          source,
        });
      }
      if (zoneIds.length > 0) {
        userTracking.capture({
          name: "zones.deleted",
          count: zoneIds.length,
          source,
        });
      }

      const deleteAssetsData = {
        assetIds: assetIds.slice(),
        shouldUpdateCustomerPoints: true,
        shouldRemoveRawControls: true,
      };
      const removeCustomerPointsData = {
        customerPointIds: customerPointIds.slice(),
      };

      transact(() => {
        const changeSets: ChangeSet[] = [];
        if (assetIds.length > 0) {
          changeSets.push(deleteAssets(hydraulicModel, deleteAssetsData));
        }
        if (customerPointIds.length > 0) {
          changeSets.push(
            removeCustomerPoints(hydraulicModel, removeCustomerPointsData),
          );
        }
        if (zoneIds.length > 0) {
          changeSets.push(
            removeZones(hydraulicModel, { zoneIds: zoneIds.slice() }),
          );
        }
        return mergeChangeSets(changeSets, "deleteSelection");
      });
    },
    [hydraulicModel, selection, transact, clearSelection, userTracking],
  );
};
