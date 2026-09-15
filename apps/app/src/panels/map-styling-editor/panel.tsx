import { MapStylingIcon } from "src/icons";
import type { PanelTemplate } from "src/panels/panel-template";
import { MapStylingEditor } from "./map-styling-editor";

export const mapStylingPanel: PanelTemplate<"map-styling"> = {
  component: () => <MapStylingEditor />,
  buildLabel: (_panel, { translate }) => translate("map"),
  icon: () => <MapStylingIcon />,
};
