import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import {
  setAllSimulationSettings,
  serializeSimulationSettings,
} from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useSimulationSettingsTransaction = () => {
  const setSettings = useSetAtom(simulationSettingsDerivedAtom);
  const setDialog = useSetAtom(dialogAtom);

  const transact = useCallback(
    (next: SimulationSettings): boolean => {
      let data: string;
      try {
        data = serializeSimulationSettings(next);
      } catch (error) {
        captureError(error instanceof Error ? error : new Error(String(error)));
        setDialog({ type: "changeNotApplied" });
        return false;
      }

      setSettings(next);

      void setAllSimulationSettings(data).catch(captureError);

      return true;
    },
    [setSettings, setDialog],
  );

  return { transact };
};
