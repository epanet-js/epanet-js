import { ScriptsIcon } from "src/icons";
import type { PanelTemplate } from "src/panels/panel-template";
import { ScriptsPanel } from "./scripts-panel";

export const scriptsPanel: PanelTemplate<"scripts"> = {
  component: () => <ScriptsPanel />,
  buildLabel: () => "Scripts",
  icon: () => <ScriptsIcon />,
};
