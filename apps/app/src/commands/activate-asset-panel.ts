import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { ASSET_PANEL_ID } from "src/panels/asset-panel/create-panel";
import { activatePanelAtom } from "src/state/panels";

export const useActivateAssetPanel = () => {
  const activatePanel = useSetAtom(activatePanelAtom);

  return useCallback(() => {
    activatePanel(ASSET_PANEL_ID);
  }, [activatePanel]);
};
