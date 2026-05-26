import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { splitsAtom } from "src/state/layout";
import { bottomActiveTabAtom } from "src/state/panel-layout";
import { hglProfileOpenAtom } from "src/state/hgl-profile";
import { useUserTracking } from "src/infra/user-tracking";

export const useShowHglProfile = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setBottomTab = useSetAtom(bottomActiveTabAtom);
  const setHglProfileOpen = useSetAtom(hglProfileOpenAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "profileView.opened", source });
      setHglProfileOpen(true);
      setSplits((s) => ({ ...s, bottomOpen: true }));
      setBottomTab("hgl-profile");
    },
    [setSplits, setBottomTab, setHglProfileOpen, userTracking],
  );
};
