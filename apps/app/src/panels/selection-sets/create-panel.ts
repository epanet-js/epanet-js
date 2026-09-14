import type { PanelOfType } from "src/panels/panel";

export const SELECTION_SETS_PANEL_ID = "selection-sets";

export const createSelectionSetsPanel = (): PanelOfType<"selection-sets"> => ({
  id: SELECTION_SETS_PANEL_ID,
  type: "selection-sets",
  initialDock: "left",
  availableInVerticalLayout: false,
  closable: false,
});
