import { useSetAtom } from "jotai";
import { useCallback } from "react";
import { splitsAtom } from "src/state/layout";
import { panelsAtom } from "src/state/panels";
import { useActivatePanel } from "./activate-panel";
import {
  SCRIPT_OUTPUT_PANEL_ID,
  createScriptOutputPanel,
} from "src/panels/script-output/create-panel";

export const useShowScriptOutput = () => {
  const setSplits = useSetAtom(splitsAtom);
  const activatePanel = useActivatePanel();
  const setPanels = useSetAtom(panelsAtom);

  return useCallback(() => {
    setPanels((prev) =>
      prev.some((panel) => panel.id === SCRIPT_OUTPUT_PANEL_ID)
        ? prev
        : [...prev, createScriptOutputPanel()],
    );
    setSplits((s) => ({ ...s, bottomOpen: true }));
    activatePanel(SCRIPT_OUTPUT_PANEL_ID);
  }, [setSplits, activatePanel, setPanels]);
};
