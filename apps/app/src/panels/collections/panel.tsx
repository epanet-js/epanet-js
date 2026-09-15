import { BookmarkIcon } from "src/icons";
import type { PanelTemplate } from "src/panels/panel-template";
import { CollectionsPanel } from "./collections-panel";

export const collectionsPanel: PanelTemplate<"collections"> = {
  component: () => <CollectionsPanel />,
  buildLabel: (_panel, { translate }) => translate("collections.title"),
  icon: () => <BookmarkIcon />,
};
