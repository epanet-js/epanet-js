import { PointerClickIcon } from "src/icons";
import type { PanelTemplate } from "src/panels/panel-template";
import FeatureEditor from "../feature-editor";

export const assetPanel: PanelTemplate<"asset"> = {
  component: () => <FeatureEditor />,
  buildLabel: (_panel, { translate }) => translate("asset"),
  icon: () => <PointerClickIcon />,
};
