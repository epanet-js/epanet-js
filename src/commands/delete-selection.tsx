import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import {
  deleteAssets,
  removeCustomerPoints,
} from "src/hydraulic-model/model-operations";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence";
import { USelection } from "src/selection";
import {
  selectionAtom,
  ephemeralStateAtom,
  modeAtom,
  Mode,
  stagingModelAtom,
} from "src/state/jotai";
export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelection = () => {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const rep = usePersistence();
  const transact = rep.useTransact();
  const userTracking = useUserTracking();

  const clearSelection = useCallback(() => {
    setSelection(USelection.none());
    setMode({ mode: Mode.NONE });
    setEphemeralState({ type: "none" });
  }, [setSelection, setMode, setEphemeralState]);

  const deleteSelectedAssets = useCallback(
    (source: AssetDeleted["source"]) => {
      const assetIds = USelection.toIds(selection);
      if (!assetIds.length) return false;

      clearSelection();

      if (assetIds.length === 1) {
        userTracking.capture({
          name: "asset.deleted",
          source,
          type: (hydraulicModel.assets.get(assetIds[0]) as Asset).type,
        });
      } else {
        userTracking.capture({
          name: "assets.deleted",
          source,
          count: assetIds.length,
        });
      }

      const moment = deleteAssets(hydraulicModel, {
        assetIds,
        shouldUpdateCustomerPoints: true,
      });
      transact(moment);
      return true;
    },
    [hydraulicModel, selection, transact, clearSelection, userTracking],
  );

  const deleteSelectedCustomerPoint = useCallback(
    (source: AssetDeleted["source"]) => {
      if (selection.type !== "singleCustomerPoint") return false;

      const customerPoint = hydraulicModel.customerPoints.get(selection.id);
      if (!customerPoint) return false;

      clearSelection();

      userTracking.capture({
        name: "customerPointActions.removed",
        count: 1,
        source,
      });

      const moment = removeCustomerPoints(hydraulicModel, {
        customerPointIds: [customerPoint.id],
      });
      transact(moment);
      return true;
    },
    [hydraulicModel, selection, transact, clearSelection, userTracking],
  );

  const deleteSelection = useCallback(
    ({ source }: { source: AssetDeleted["source"] }) => {
      deleteSelectedAssets(source) || deleteSelectedCustomerPoint(source);
    },
    [deleteSelectedAssets, deleteSelectedCustomerPoint],
  );

  return deleteSelection;
};
