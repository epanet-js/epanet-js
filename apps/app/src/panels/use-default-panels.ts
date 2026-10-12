import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { getScripting } from "src/lib/scripting";
import { createNetworkReviewPanel } from "./network-review/create-panel";
import { createCollectionsPanel } from "./collections/create-panel";
import { createAssetPanel } from "./asset-panel/create-panel";
import { createMapStylingPanel } from "./map-styling-editor/create-panel";
import { createScriptsPanel } from "./scripts/create-panel";
import type { Panel } from "./panel";

export const useDefaultPanels = () => {
  const isScriptingOn = useFeatureFlag("FLAG_SCRIPTING");

  return useCallback(
    (): Panel[] => [
      createNetworkReviewPanel(),
      createCollectionsPanel(),
      createAssetPanel(),
      createMapStylingPanel(),
      ...(isScriptingOn && getScripting() ? [createScriptsPanel()] : []),
    ],
    [isScriptingOn],
  );
};
