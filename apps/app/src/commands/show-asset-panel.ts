import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { splitsAtom } from "src/state/layout";
import { useActivateAssetPanel } from "./activate-asset-panel";

export const useShowAssetPanel = () => {
  const setSplits = useSetAtom(splitsAtom);
  const activateAssetPanel = useActivateAssetPanel();
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "draw" | "modelAttributesValidation" }) => {
      userTracking.capture({ name: "assetPanel.opened", source });
      setSplits((s) => (s.rightOpen ? s : { ...s, rightOpen: true }));
      activateAssetPanel();
    },
    [setSplits, activateAssetPanel, userTracking],
  );
};
