import { useAtomValue, useSetAtom } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import { bottomPanelViewAtom, splitsAtom } from "src/state/layout";

export const useToggleProfileView = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeral = useSetAtom(ephemeralStateAtom);
  const setSplits = useSetAtom(splitsAtom);
  const setBottomView = useSetAtom(bottomPanelViewAtom);

  return () => {
    if (mode === Mode.PROFILE_VIEW) return;

    setProfileView(null);
    setEphemeral({ type: "profileView" });
    setMode({ mode: Mode.PROFILE_VIEW });
    // TEMP: remove with panel registry migration
    setSplits((s) => ({ ...s, bottomOpen: true }));
    setBottomView("profileView");
  };
};
