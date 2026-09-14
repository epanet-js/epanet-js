import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { createNetworkReviewPanel } from "./network-review/create-panel";
import { createSelectionSetsPanel } from "./selection-sets/create-panel";
import type { Panel } from "./panel";

export const useDefaultPanels = () => {
  const isSelectionSetsOn = useFeatureFlag("FLAG_SELECTION_SETS");

  return useCallback(
    (): Panel[] => [
      createNetworkReviewPanel(),
      ...(isSelectionSetsOn ? [createSelectionSetsPanel()] : []),
    ],
    [isSelectionSetsOn],
  );
};
