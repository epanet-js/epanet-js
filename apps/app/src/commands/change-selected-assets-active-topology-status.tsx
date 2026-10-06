import { useAtomValue } from "jotai";
import { useCallback } from "react";
import {
  activateAssets,
  activateAssetsDeprecated,
} from "src/hydraulic-model/model-operations/activate-assets";
import {
  deactivateAssets,
  deactivateAssetsDeprecated,
} from "src/hydraulic-model/model-operations/deactivate-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { useMomentTransaction } from "src/hooks/persistence/use-moment-transaction";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const changeActiveTopologyShortcut = "a";

export const useChangeSelectedAssetsActiveTopologyStatus = () => {
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const { transact } = useMomentTransaction();
  const { transact: transactChangeSet } = useModelTransaction();
  const isOpsChangeSetsOn = useFeatureFlag("FLAG_OPS_CHANGE_SETS");

  const selectedIds = USelection.getAssetIds(selection);

  const inactiveAssetIds = selectedIds.filter((assetId) => {
    const asset = hydraulicModel.assets.get(assetId);
    return !(asset?.isActive ?? true);
  });

  const changeSelectedAssetsActiveTopologyStatus = useCallback(
    ({ source }: { source: "shortcut" | "toolbar" | "context-menu" }) => {
      if (selectedIds.length === 0) return;

      const assetIds = [...selectedIds];

      if (inactiveAssetIds.length) {
        userTracking.capture({
          name: "assets.includedInActiveTopology",
          source,
          count: inactiveAssetIds.length,
        });

        if (isOpsChangeSetsOn) {
          transactChangeSet(() => activateAssets(hydraulicModel, { assetIds }));
        } else {
          transact(activateAssetsDeprecated(hydraulicModel, { assetIds }));
        }
      } else {
        userTracking.capture({
          name: "assets.excludedFromActiveTopology",
          source,
          count: assetIds.length,
        });

        if (isOpsChangeSetsOn) {
          transactChangeSet(() =>
            deactivateAssets(hydraulicModel, { assetIds }),
          );
        } else {
          transact(deactivateAssetsDeprecated(hydraulicModel, { assetIds }));
        }
      }
    },
    [
      selectedIds,
      inactiveAssetIds,
      hydraulicModel,
      userTracking,
      isOpsChangeSetsOn,
      transact,
      transactChangeSet,
    ],
  );

  return {
    changeSelectedAssetsActiveTopologyStatus,
    allActive: inactiveAssetIds.length === 0,
  };
};
