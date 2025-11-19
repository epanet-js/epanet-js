import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { activateAssets } from "src/hydraulic-model/model-operations/activate-assets";
import { deactivateAssets } from "src/hydraulic-model/model-operations/deactivate-assets";
import { useUserTracking } from "src/infra/user-tracking";
import { usePersistence } from "src/lib/persistence/context";
import { USelection } from "src/selection";
import { dataAtom, selectionAtom } from "src/state/jotai";

export const changeActiveTopologyShortcut = "a";

export const useChangeSelectedAssetsActiveTopologyStatus = () => {
  const { hydraulicModel } = useAtomValue(dataAtom);
  const selection = useAtomValue(selectionAtom);
  const userTracking = useUserTracking();
  const rep = usePersistence();
  const transact = rep.useTransact();

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
