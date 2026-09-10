import { type PanelOfType } from "src/panels/panel";

export const NETWORK_REVIEW_PANEL_ID = "network-review";

export const createNetworkReviewPanel = (): PanelOfType<"network-review"> => ({
  id: NETWORK_REVIEW_PANEL_ID,
  type: "network-review",
  initialDock: "left",
  availableInVerticalLayout: false,
  closable: false,
});
