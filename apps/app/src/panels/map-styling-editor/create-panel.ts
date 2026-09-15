import type { PanelOfType } from "src/panels/panel";

export const MAP_STYLING_PANEL_ID = "map-styling";

export const createMapStylingPanel = (): PanelOfType<"map-styling"> => ({
  id: MAP_STYLING_PANEL_ID,
  type: "map-styling",
  initialDock: "right",
  availableInVerticalLayout: false,
  closable: false,
});
