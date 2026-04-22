import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { setAllSimulationSettings } from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useSimulationSettingsTransaction = () => {
  const setSettings = useSetAtom(simulationSettingsDerivedAtom);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const transact = useCallback(
    (next: SimulationSettings) => {
      setSettings(next);
      if (isOurFileOn) {
        void setAllSimulationSettings(next).catch(captureError);
      }
    },
    [setSettings, isOurFileOn],
  );

  return { transact };
};
