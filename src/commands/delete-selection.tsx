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
import { ephemeralStateAtom } from "src/state/drawing";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelection = () => {
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const { transact: transactNew } = useModelTransaction();
  const transact = isStateRefactorOn ? transactNew : transactDeprecated;
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
