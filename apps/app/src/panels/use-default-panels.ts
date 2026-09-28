import { useCallback } from "react";
import { createNetworkReviewPanel } from "./network-review/create-panel";
import { createCollectionsPanel } from "./collections/create-panel";
import { createAssetPanel } from "./asset-panel/create-panel";
import { createMapStylingPanel } from "./map-styling-editor/create-panel";
import type { Panel } from "./panel";

export const useDefaultPanels = () => {
  return useCallback(
    (): Panel[] => [
      createNetworkReviewPanel(),
      createCollectionsPanel(),
      createAssetPanel(),
      createMapStylingPanel(),
    ],
    [],
  );
};
