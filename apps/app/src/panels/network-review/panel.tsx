import type { PanelTemplate } from "src/panels/panel-template";
import { NetworkReview } from "./network-review";

export const networkReviewPanel: PanelTemplate<"network-review"> = {
  component: () => <NetworkReview />,
  buildLabel: (_panel, { translate }) => translate("networkReview.title"),
};
