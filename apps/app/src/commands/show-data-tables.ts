import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { splitsAtom } from "src/state/layout";
import { useActivatePanel } from "./activate-panel";

export const useShowDataTables = () => {
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "dataTables.opened", source });
      setSplits((s) => ({ ...s, bottomOpen: true }));
      activatePanel("junction");
    },
    [setSplits, activatePanel, userTracking],
  );
};
