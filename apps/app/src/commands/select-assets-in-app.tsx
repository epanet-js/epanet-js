import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { AssetId } from "src/hydraulic-model";
import { useSelection } from "src/selection/use-selection";
import { selectionAtom } from "src/state/selection";

export const useSelectAssetsInApp = () => {
  const selection = useAtomValue(selectionAtom);
  const { selectAssets } = useSelection(selection);

  return useCallback(
    (assetIds: AssetId[]) => {
      if (assetIds.length === 0) return;
      selectAssets(assetIds);
    },
    [selectAssets],
  );
};
