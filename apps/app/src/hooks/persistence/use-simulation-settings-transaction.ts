import { useCallback } from "react";
import { useSetAtom } from "jotai";
import type { SimulationSettings } from "src/simulation/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  setAllSimulationSettings,
  serializeSimulationSettings,
} from "src/lib/db";
import { captureError } from "src/infra/error-tracking";

export const useSimulationSettingsTransaction = () => {
  const setSettings = useSetAtom(simulationSettingsDerivedAtom);
  const setDialog = useSetAtom(dialogAtom);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");
  const isSchemaFirstOn = useFeatureFlag("FLAG_SCHEMA_FIRST");

  const transact = useCallback(
    (next: SimulationSettings): boolean => {
      let data: string | undefined;
      if (isOurFileOn && isSchemaFirstOn) {
        try {
          data = serializeSimulationSettings(next);
        } catch (error) {
          captureError(
            error instanceof Error ? error : new Error(String(error)),
          );
          setDialog({ type: "changeNotApplied" });
          return false;
        }
      }

      setSettings(next);

      if (isOurFileOn) {
        if (data) {
          void setAllSimulationSettings(data).catch(captureError);
        } else {
          void (async () =>
            setAllSimulationSettings(
              serializeSimulationSettings(next),
            ))().catch(captureError);
        }
      }

      return true;
    },
    [setSettings, setDialog, isOurFileOn, isSchemaFirstOn],
  );

  return { transact };
};
