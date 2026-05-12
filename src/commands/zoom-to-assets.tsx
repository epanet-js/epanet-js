import { useCallback } from "react";
import { AssetId } from "src/hydraulic-model";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { USelection } from "src/selection";

export const useZoomToAssets = () => {
  const zoomTo = useZoomTo();

  return useCallback(
    (assetIds: AssetId[]) => {
      if (assetIds.length === 0) return;
      zoomTo(USelection.fromIds(assetIds));
    },
    [zoomTo],
  );
};
