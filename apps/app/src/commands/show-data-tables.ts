import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { splitsAtom } from "src/state/layout";
import { bottomActiveTabAtom } from "src/state/panel-layout";

export const useShowDataTables = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setBottomTab = useSetAtom(bottomActiveTabAtom);
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "dataTables.opened", source });
      setSplits((s) => ({ ...s, bottomOpen: true }));
      setBottomTab("junction");
    },
    [setSplits, setBottomTab, userTracking],
  );
};
