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
import { captureError, captureInfo } from "src/infra/error-tracking";

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
      uniqueId: string | null;
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
  const isWriteDbToOpfsOn = useFeatureFlag("FLAG_WRITE_DB_TO_OPFS");
  const isReadDbFromOpfsOn = useFeatureFlag("FLAG_READ_DB_FROM_OPFS");
  const isTrackModelSharingOn = useFeatureFlag("FLAG_TRACK_MODEL_SHARING");

  const openPersistedProject = useAtomCallback(
    useCallback(
      async (
        _get: Getter,
        set: Setter,
        { file, onProgress }: OpenPersistedProjectInput,
      ): Promise<OpenPersistedProjectResult> => {
        const start_time = performance.now();
        const result = await db.openProject(file);
        captureInfo("openProject() performance", {
          elapsedTimeMs: performance.now() - start_time,
          isWriteDbToOpfsOn,
          isReadDbFromOpfsOn,
        });

        if (result.status !== "ok" && result.status !== "migrated") {
          return result;
        }

        let uniqueId: string | null = null;
        if (isTrackModelSharingOn) {
          try {
            uniqueId = await db.ensureUniqueId();
          } catch (error) {
            captureError(error as Error);
          }
        }

        const fetchProject = db.fetchProject;
        const {
          projectSettings,
          pipeLibrary,
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
          pipeLibrary,
          zones,
          simulationSettings,
          autoElevations: projectSettings.projection.type !== "xy-grid",
        });
        return {
          status: "ok",
          modelVersion: hydraulicModel.version,
          hydraulicModel,
          projectSettings,
          uniqueId,
        };
      },
      [isWriteDbToOpfsOn, isReadDbFromOpfsOn, isTrackModelSharingOn],
    ),
  );

  return { openPersistedProject };
};
