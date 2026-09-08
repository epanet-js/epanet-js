import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import {
  TABLE_PICKER_PANEL_ID,
  createTablePickerPanel,
} from "src/panels/data-tables/create-panel";
import { splitsAtom } from "src/state/layout";
import { panelsAtom } from "src/state/panels";
import { useActivatePanel } from "./activate-panel";

export const useShowDataTables = () => {
  const setSplits = useSetAtom(splitsAtom);
  const setPanels = useSetAtom(panelsAtom);
  const activatePanel = useActivatePanel();
  const partialDataTables = useFeatureFlag("FLAG_PARTIAL_DATA_TABLES");
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: "toolbar" | "shortcut" }) => {
      userTracking.capture({ name: "dataTables.opened", source });
      setSplits((s) => ({ ...s, bottomOpen: true }));

      if (!partialDataTables) {
        activatePanel("junction");
        return;
      }

      setPanels((prev) =>
        prev.some((panel) => panel.id === TABLE_PICKER_PANEL_ID)
          ? prev
          : [...prev, createTablePickerPanel()],
      );
      activatePanel(TABLE_PICKER_PANEL_ID);
    },
    [setSplits, setPanels, activatePanel, partialDataTables, userTracking],
  );
};
