import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { splitsAtom } from "src/state/layout";
import { bottomActiveTabAtom } from "src/state/panel-layout";
import { useUserTracking } from "src/infra/user-tracking";

export const useShowProfileView = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setBottomTab = useSetAtom(bottomActiveTabAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "profileView.opened", source });
      setSplits((s) => ({ ...s, bottomOpen: true }));
      setBottomTab("profile-view");
    },
    [setSplits, setBottomTab, userTracking],
  );
};
