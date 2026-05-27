import { useCallback } from "react";
import { useAtom } from "jotai";
import { projectSettingsAtom } from "src/state/project-settings";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { importZoneFeatures } from "src/lib/zones";
import type { ZoneFeature } from "src/lib/zones";
import * as db from "src/lib/db";

export const useImportZoneFeatures = () => {
  const [projectSettings, setProjectSettings] = useAtom(projectSettingsAtom);
  const isOurFileOn = useFeatureFlag("FLAG_OUR_FILE");

  const importFeatures = useCallback(
    async (features: ZoneFeature[], labelProperty?: string) => {
      const zones = importZoneFeatures(features, labelProperty);
      const newProjectSettings = { ...projectSettings, zones };

      setProjectSettings(newProjectSettings);

      if (isOurFileOn) {
        await db.saveProjectSettings(newProjectSettings);
      }
    },
    [projectSettings, setProjectSettings, isOurFileOn],
  );

  return importFeatures;
};
