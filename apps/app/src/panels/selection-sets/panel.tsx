import type { PanelTemplate } from "src/panels/panel-template";
import { SelectionSetsPanel } from "./selection-sets-panel";

export const selectionSetsPanel: PanelTemplate<"selection-sets"> = {
  component: () => <SelectionSetsPanel />,
  buildLabel: () => "Selections",
};
