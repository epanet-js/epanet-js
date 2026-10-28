import type { PanelOfType } from "src/panels/panel";

export const SCRIPT_OUTPUT_PANEL_ID = "script-output";

export const createScriptOutputPanel = (): PanelOfType<"script-output"> => ({
  id: SCRIPT_OUTPUT_PANEL_ID,
  type: "script-output",
  initialDock: "bottom",
  availableInVerticalLayout: true,
  closable: true,
});
