import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/db";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import {
  clearSimulationStorage,
  loadModel,
  resetAppState,
} from "./use-start-new-project";

type OpenPersistedProjectInput = {
  file: File;
};

export type OpenPersistedProjectResult =
  | { status: "ok"; modelVersion: string }
  | { status: "too-new"; fileVersion: number; appVersion: number };

export const useOpenPersistedProject = () => {
  const openPersistedProject = useAtomCallback(
    useCallback(
      async (
        _get: Getter,
        set: Setter,
        { file }: OpenPersistedProjectInput,
      ): Promise<OpenPersistedProjectResult> => {
        const result = await db.openProject(file);
        if (result.status === "too-new") {
          return {
            status: "too-new",
            fileVersion: result.fileVersion,
            appVersion: result.appVersion,
          };
        }
        const { projectSettings, hydraulicModel, factories } =
          await db.fetchProject();
        await clearSimulationStorage();
        resetAppState(set);
        loadModel(set, {
          hydraulicModel,
          factories,
          projectSettings,
          simulationSettings: defaultSimulationSettings,
          autoElevations: projectSettings.projection.type !== "xy-grid",
        });
        return { status: "ok", modelVersion: hydraulicModel.version };
      },
      [],
    ),
  );

  return { openPersistedProject };
};
