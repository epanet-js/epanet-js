import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";
import { splitsAtom } from "src/state/layout";
import { useActivatePanel } from "./activate-panel";

export const useShowDataTables = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setDialogState = useSetAtom(dialogAtom);
  const activatePanel = useActivatePanel();
  const partialDataTables = useFeatureFlag("FLAG_PARTIAL_DATA_TABLES");
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "dataTables.opened", source });

      if (partialDataTables) {
        setDialogState({ type: "openDataTables" });
        return;
      }

      setSplits((s) => ({ ...s, bottomOpen: true }));
      activatePanel("junction");
    },
    [setSplits, setDialogState, activatePanel, partialDataTables, userTracking],
  );
};
