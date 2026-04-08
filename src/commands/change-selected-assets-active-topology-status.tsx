import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence";
import { USelection } from "src/selection";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useModelTransaction } from "src/hooks/persistence/use-model-transaction";

export const changeActiveTopologyShortcut = "a";

export const useChangeSelectedAssetsActiveTopologyStatus = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const hydraulicModel = useAtomValue(
    isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
  );
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const rep = usePersistence();
  const transactDeprecated = rep.useTransactDeprecated();
  const { transact: transactNew } = useModelTransaction();
  const transact = isStateRefactorOn ? transactNew : transactDeprecated;

  const selectedIds = USelection.toIds(selection);

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

        const moment = activateAssets(hydraulicModel, { assetIds });
        transact(moment);
      } else {
        userTracking.capture({
          name: "assets.excludedFromActiveTopology",
          source,
          count: assetIds.length,
        });

        const moment = deactivateAssets(hydraulicModel, { assetIds });
        transact(moment);
      }
    },
    [selectedIds, inactiveAssetIds, hydraulicModel, userTracking, transact],
  );

  return {
    changeSelectedAssetsActiveTopologyStatus,
    allActive: inactiveAssetIds.length === 0,
  };
};
