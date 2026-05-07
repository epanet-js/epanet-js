import { useAtomValue, useSetAtom } from "jotai";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import { splitsAtom } from "src/state/layout";
import { bottomActiveTabAtom } from "src/state/panel-layout";

export const useToggleProfileView = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeral = useSetAtom(ephemeralStateAtom);
  const setSplits = useSetAtom(splitsAtom);
  const setBottomTab = useSetAtom(bottomActiveTabAtom);

  return () => {
    if (mode === Mode.PROFILE_VIEW) return;

    setProfileView(null);
    setEphemeral({ type: "profileView" });
    setMode({ mode: Mode.PROFILE_VIEW });
    setSplits((s) => ({ ...s, bottomOpen: true }));
    setBottomTab("profile-view");
  };
};
