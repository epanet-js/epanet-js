import { useEffect } from "react";
import { useAtomValue } from "jotai";
import { simulationResultsDerivedAtom } from "src/state/derived-branch-state";
import { hideNotification } from "src/components/notifications";
import { profileSimulationRequiredToastId } from "src/commands/start-profile-selection";

export const ProfileSimulationToastGuard = () => {
  const resultsReader = useAtomValue(simulationResultsDerivedAtom);

  useEffect(() => {
    if (resultsReader) {
      hideNotification(profileSimulationRequiredToastId);
    }
  }, [resultsReader]);

  return null;
};
