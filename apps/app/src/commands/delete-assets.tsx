import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { AssetId } from "src/hydraulic-model";
import {
  deleteAssets,
  deleteAssetsDeprecated,
} from "src/hydraulic-model/model-operations";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const useDeleteAssets = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");
  const userTracking = useUserTracking();

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

      const data = {
        assetIds,
        shouldUpdateCustomerPoints: true,
        shouldRemoveRawControls: true,
      };
      if (isOpsChangeSetsOn) {
        transactChangeSet(() => deleteAssets(hydraulicModel, data));
      } else {
        transact(deleteAssetsDeprecated(hydraulicModel, data));
      }
    },
    [
      hydraulicModel,
      selection,
      setSelection,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
      userTracking,
    ],
  );
};
