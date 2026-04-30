import { useAtomValue, useSetAtom } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import { bottomPanelViewAtom, splitsAtom } from "src/state/layout";
import { selectionAtom } from "src/state/selection";
import { SELECTION_NONE } from "src/selection/selection";
import { useDrawingMode } from "src/commands/set-drawing-mode";

export const useToggleProfileView = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeral = useSetAtom(ephemeralStateAtom);
  const setSplits = useSetAtom(splitsAtom);
  const setBottomView = useSetAtom(bottomPanelViewAtom);
  const setSelection = useSetAtom(selectionAtom);
  const setDrawingMode = useDrawingMode();

  return () => {
    if (mode === Mode.PROFILE_VIEW) {
      setProfileView({ phase: "idle" });
      setEphemeral({ type: "none" });
      setSelection(SELECTION_NONE);
      void setDrawingMode(Mode.NONE);
    } else {
      setProfileView({ phase: "selectingStart" });
      setEphemeral({ type: "profileView" });
      setSelection(SELECTION_NONE);
      setMode({ mode: Mode.PROFILE_VIEW });
      // TEMP: remove with panel registry migration
      setSplits((s) => ({ ...s, bottomOpen: true }));
      setBottomView("profileView");
    }
  };
};
