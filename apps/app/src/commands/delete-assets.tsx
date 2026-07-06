import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { AssetId } from "src/hydraulic-model";
import { deleteAssets } from "src/hydraulic-model/model-operations";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const useDeleteAssets = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const { transact } = useMomentTransaction();
  const userTracking = useUserTracking();
  const isRemoveControlsOn = useFeatureFlag("FLAG_REMOVE_CONTROLS");

  return useCallback(
    (assetIds: AssetId[], source: AssetDeleted["source"]) => {
      if (assetIds.length === 0) return;

      if (assetIds.length === 1) {
        const asset = hydraulicModel.assets.get(assetIds[0]);
        if (!asset) return;
        userTracking.capture({
          name: "asset.deleted",
          source,
          type: asset.type,
        });
      } else {
        userTracking.capture({
          name: "assets.deleted",
          source,
          count: assetIds.length,
        });
      }

      const currentAssetIds = USelection.getAssetIds(selection);
      const currentCustomerPointIds = USelection.getCustomerPointIds(selection);
      const deletedSet = new Set(assetIds);
      const intersects = currentAssetIds.some((id) => deletedSet.has(id));
      if (intersects) {
        const remainingAssetIds = currentAssetIds.filter(
          (id) => !deletedSet.has(id),
        );
        setSelection(
          USelection.fromIds(remainingAssetIds, currentCustomerPointIds),
        );
      }

      const moment = deleteAssets(hydraulicModel, {
        assetIds,
        shouldUpdateCustomerPoints: true,
        shouldRemoveRawControls: isRemoveControlsOn,
      });
      transact(moment);
    },
    [
      hydraulicModel,
      selection,
      setSelection,
      transact,
      userTracking,
      isRemoveControlsOn,
    ],
  );
};
