import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import type { Getter, Setter } from "jotai";
import * as db from "src/lib/db";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "src/lib/project-settings";
import type { FetchProjectPhase } from "src/lib/db";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  clearSimulationStorage,
  loadModel,
  resetAppState,
} from "./use-start-new-project";

export type OpenPersistedProjectPhase = FetchProjectPhase | "finalizing";

type OpenPersistedProjectInput = {
  file: File;
  onProgress?: (phase: OpenPersistedProjectPhase) => void;
};

export type OpenPersistedProjectResult =
  | {
      status: "ok";
      modelVersion: string;
      hydraulicModel: HydraulicModel;
      projectSettings: ProjectSettings;
    }
  | { status: "too-new"; fileVersion: number; appVersion: number }
  | { status: "corrupt" | "internal"; errorDetails: string }
  | {
      status: "migration-failed";
      errorDetails: string;
      fileVersion: number;
      appVersion: number;
    };

export const useOpenPersistedProject = () => {
  const allowsNullValues = useFeatureFlag("FLAG_NULL_VALUES");

  const openPersistedProject = useAtomCallback(
    useCallback(
      async (
        _get: Getter,
        set: Setter,
        { file, onProgress }: OpenPersistedProjectInput,
      ): Promise<OpenPersistedProjectResult> => {
        const result = await db.openProject(file);
        if (result.status !== "ok" && result.status !== "migrated") {
          return result;
        }
        const fetchProject = allowsNullValues
          ? db.fetchProjectWithNullValues
          : db.fetchProject;
        const {
          projectSettings,
          zones,
          hydraulicModel,
          factories,
          simulationSettings,
        } = await fetchProject({ onProgress });
        onProgress?.("finalizing");
        await clearSimulationStorage();
        resetAppState(set);
        loadModel(set, {
          hydraulicModel,
          factories,
          projectSettings,
          zones,
          simulationSettings,
          autoElevations: projectSettings.projection.type !== "xy-grid",
        });
        return {
          status: "ok",
          modelVersion: hydraulicModel.version,
          hydraulicModel,
          projectSettings,
        };
      },
      [allowsNullValues],
    ),
  );

  return { openPersistedProject };
};
