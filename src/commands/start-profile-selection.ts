import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { Mode, modeAtom } from "src/state/mode";
import { profileViewAtom } from "src/state/profile-view";
import { ephemeralStateAtom } from "src/state/drawing";
import { useUserTracking } from "src/infra/user-tracking";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";
import { notify } from "src/components/notifications";
import { useTranslate } from "src/hooks/use-translate";

export const profileSimulationRequiredToastId =
  "profile-view-simulation-required-toast";

export const useStartProfileSelection = () => {
  const { mode } = useAtomValue(modeAtom);
  const setMode = useSetAtom(modeAtom);
  const setProfileView = useSetAtom(profileViewAtom);
  const setEphemeral = useSetAtom(ephemeralStateAtom);
  const userTracking = useUserTracking();
  const resultsReader = useAtomValue(simulationResultsDerivedAtom);
  const translate = useTranslate();

  return useCallback(
    ({ source }: { source: "toolbar" | "panel" | "shortcut" }) => {
      if (mode === Mode.PROFILE_VIEW) return;

      if (!resultsReader) {
        notify({
          variant: "warning",
          title: translate("profileView.simulationRequired"),
          description: translate("profileView.simulationRequiredHint"),
          id: profileSimulationRequiredToastId,
          duration: Infinity,
        });
        return;
      }

      userTracking.capture({ name: "profileView.selectionStarted", source });
      setProfileView(null);
      setEphemeral({ type: "profileView" });
      setMode({ mode: Mode.PROFILE_VIEW });
    },
    [
      mode,
      setMode,
      setProfileView,
      setEphemeral,
      userTracking,
      resultsReader,
      translate,
    ],
  );
};
