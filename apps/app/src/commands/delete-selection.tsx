import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  deleteAssets,
  deleteAssetsDeprecated,
  mergeChangeSets,
  mergeMoments,
  removeCustomerPoints,
  removeCustomerPointsDeprecated,
} from "src/hydraulic-model/model-operations";
import type { ChangeSet } from "@epanet-js/change-set";
import type { ModelMoment } from "src/hydraulic-model/model-operation";
import { AssetDeleted, useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { ephemeralStateAtom } from "src/state/drawing";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { modeAtom, Mode } from "src/state/mode";
import { selectionAtom } from "src/state/selection";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
export const deleteSelectedShortcuts = ["backspace", "del"];

export const useDeleteSelection = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const [selection, setSelection] = useAtom(selectionAtom);
  const setMode = useSetAtom(modeAtom);
  const setEphemeralState = useSetAtom(ephemeralStateAtom);
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");
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

      const deleteAssetsData = {
        assetIds: assetIds.slice(),
        shouldUpdateCustomerPoints: true,
        shouldRemoveRawControls: true,
      };
      const removeCustomerPointsData = {
        customerPointIds: customerPointIds.slice(),
      };

      if (isOpsChangeSetsOn) {
        const changeSets: ChangeSet[] = [];
        if (assetIds.length > 0) {
          changeSets.push(deleteAssets(hydraulicModel, deleteAssetsData));
        }
        if (customerPointIds.length > 0) {
          changeSets.push(
            removeCustomerPoints(hydraulicModel, removeCustomerPointsData),
          );
        }
        const merged = mergeChangeSets(changeSets, "Delete selection");
        if (merged) transactChangeSet(merged);
      } else {
        const moments: ModelMoment[] = [];
        if (assetIds.length > 0) {
          moments.push(
            deleteAssetsDeprecated(hydraulicModel, deleteAssetsData),
          );
        }
        if (customerPointIds.length > 0) {
          moments.push(
            removeCustomerPointsDeprecated(
              hydraulicModel,
              removeCustomerPointsData,
            ),
          );
        }
        const merged = mergeMoments(moments, "Delete selection");
        if (merged) transact(merged);
      }
    },
    [
      hydraulicModel,
      selection,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
      clearSelection,
      userTracking,
    ],
  );
};
