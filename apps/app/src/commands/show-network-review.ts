import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { NETWORK_REVIEW_PANEL_ID } from "src/panels/network-review/create-panel";
import { defaultSplits, splitsAtom } from "src/state/layout";
import { useActivatePanel } from "./activate-panel";

export const useShowNetworkReview = () => {
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "auto" }) => {
      userTracking.capture({ name: "networkReview.opened", source });
      setSplits((s) => ({
        ...s,
        leftOpen: true,
        left: defaultSplits.left,
      }));
      activatePanel(NETWORK_REVIEW_PANEL_ID);
    },
    [setSplits, activatePanel, userTracking],
  );
};
