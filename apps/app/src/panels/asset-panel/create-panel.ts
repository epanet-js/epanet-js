import type { PanelOfType } from "src/panels/panel";

export const ASSET_PANEL_ID = "asset";

export const createAssetPanel = (): PanelOfType<"asset"> => ({
  id: ASSET_PANEL_ID,
  type: "asset",
  initialDock: "right",
  availableInVerticalLayout: false,
  closable: false,
});
