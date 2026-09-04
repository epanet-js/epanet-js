import { type PanelOfType } from "src/panels/panel";

export const HGL_PANEL_ID = "hgl-profile";

export const createHglProfilePanel = (): PanelOfType<"hgl-profile"> => ({
  id: HGL_PANEL_ID,
  type: "hgl-profile",
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable: true,
});
