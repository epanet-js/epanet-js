import type { PanelOfType } from "src/panels/panel";

export const SCRIPTS_PANEL_ID = "scripts";

export const createScriptsPanel = (): PanelOfType<"scripts"> => ({
  id: SCRIPTS_PANEL_ID,
  type: "scripts",
  initialDock: "left",
  availableInVerticalLayout: false,
  closable: false,
});
