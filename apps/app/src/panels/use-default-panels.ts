import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { createNetworkReviewPanel } from "./network-review/create-panel";
import { createCollectionsPanel } from "./collections/create-panel";
import { createAssetPanel } from "./asset-panel/create-panel";
import { createMapStylingPanel } from "./map-styling-editor/create-panel";
import type { Panel } from "./panel";

export const useDefaultPanels = () => {
  const isSelectionSetsOn = useFeatureFlag("FLAG_SELECTION_SETS");

  return useCallback(
    (): Panel[] => [
      createNetworkReviewPanel(),
      ...(isSelectionSetsOn ? [createCollectionsPanel()] : []),
      createAssetPanel(),
      createMapStylingPanel(),
    ],
    [isSelectionSetsOn],
  );
};
