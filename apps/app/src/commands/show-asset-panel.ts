import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { TabOption, tabAtom } from "src/state/layout";
import { activatePanelAtom } from "src/state/panels";
import { ASSET_PANEL_ID } from "src/panels/asset-panel/create-panel";

export const useShowAssetPanel = () => {
  const setTab = useSetAtom(tabAtom);
  const activatePanel = useSetAtom(activatePanelAtom);

  return useCallback(() => {
    setTab(TabOption.Asset);
    activatePanel(ASSET_PANEL_ID);
  }, [setTab, activatePanel]);
};
