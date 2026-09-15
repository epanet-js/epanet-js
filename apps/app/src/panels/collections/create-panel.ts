import type { PanelOfType } from "src/panels/panel";

export const COLLECTIONS_PANEL_ID = "collections";

export const createCollectionsPanel = (): PanelOfType<"collections"> => ({
  id: COLLECTIONS_PANEL_ID,
  type: "collections",
  initialDock: "left",
  availableInVerticalLayout: false,
  closable: false,
});
