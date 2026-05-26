import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
import { AssetId } from "src/hydraulic-model";
import { deleteAssets } from "src/hydraulic-model/model-operations";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const useDeleteAssets = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const { transact } = useModelTransaction();
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

      const currentIds = new Set(USelection.toIds(selection));
      const intersects = assetIds.some((id) => currentIds.has(id));
      if (intersects) {
        const remaining = USelection.toIds(selection).filter(
          (id) => !assetIds.includes(id),
        );
        setSelection(
          remaining.length === 0
            ? USelection.none()
            : USelection.fromIds(remaining),
        );
      }

      const moment = deleteAssets(hydraulicModel, {
        assetIds,
        shouldUpdateCustomerPoints: true,
      });
      transact(moment);
    },
    [hydraulicModel, selection, setSelection, transact, userTracking],
  );
};
