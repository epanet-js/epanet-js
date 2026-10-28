import { ScriptsIcon } from "src/icons";
import type { PanelTemplate } from "src/panels/panel-template";
import { scriptRunAtom } from "src/state/scripts";
import { ScriptOutputPanel } from "./script-output-panel";

export const scriptOutputPanel: PanelTemplate<"script-output"> = {
  component: ({ panel }) => <ScriptOutputPanel panelId={panel.id} />,
  buildLabel: () => "Script output",
  icon: () => <ScriptsIcon />,
  onClose: ({ get, set }) => {
    if (get(scriptRunAtom)?.status === "finished") set(scriptRunAtom, null);
  },
};
