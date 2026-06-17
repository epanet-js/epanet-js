import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Asset } from "src/hydraulic-model";
import {
  deleteAssets,
  mergeMoments,
  removeCustomerPoints,
} from "src/hydraulic-model/model-operations";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
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
      if (assetIds.length === 0 && customerPointIds.length === 0) return;

      clearSelection();

      if (assetIds.length === 1 && customerPointIds.length === 0) {
        userTracking.capture({
          name: "asset.deleted",
          source,
          type: (hydraulicModel.assets.get(assetIds[0]) as Asset).type,
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

      const moments: ModelMoment[] = [];
      if (assetIds.length > 0) {
        moments.push(
          deleteAssets(hydraulicModel, {
            assetIds: assetIds.slice(),
            shouldUpdateCustomerPoints: true,
          }),
        );
      }
      if (customerPointIds.length > 0) {
        moments.push(
          removeCustomerPoints(hydraulicModel, {
            customerPointIds: customerPointIds.slice(),
          }),
        );
      }
      const merged = mergeMoments(moments, "Delete selection");
      if (merged) transact(merged);
    },
    [hydraulicModel, selection, transact, clearSelection, userTracking],
  );
};
