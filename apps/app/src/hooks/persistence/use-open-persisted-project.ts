import { useCallback } from "react";
import { useAtomCallback } from "jotai/utils";
import { useDefaultPanels } from "src/panels/use-default-panels";
import type { Setter } from "jotai";
import * as db from "src/lib/db";
import type { HydraulicModel } from "src/hydraulic-model";
import type { ProjectSettings } from "@epanet-js/project-settings";
import type { FetchProjectPhase } from "src/lib/db";
import {
  buildMainBranchState,
  clearSimulationStorage,
  loadModel,
  resetAppState,
  type ProjectLoadInput,
} from "./use-start-new-project";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { getBranchStore } from "src/lib/branching";
import {
  buildStoredBranchStates,
  commitStoredBranches,
} from "./use-initialize-branch";
import type { Worktree } from "@epanet-js/worktree";
import type { BranchState } from "src/state/branch-state";
import { startTrace, type Trace } from "src/infra/trace";
import { isTraceProjectOpenOn } from "src/infra/debug-mode";
import { markProjectSavedAtom } from "src/state/project-revision";

type RestoredBranches = {
  worktree: Worktree;
  branchStates: Map<string, BranchState>;
};

const restoreBranches = async (
  loadInput: ProjectLoadInput,
  trace: Trace,
): Promise<RestoredBranches> => {
  const storedBranches = await trace.measureAsync("load-scenarios", () =>
    getBranchStore().load(),
  );
  const mainState = trace.measure("build-main-state", () =>
    buildMainBranchState(loadInput),
  );
  return {
    worktree: storedBranches.worktree,
    branchStates: buildStoredBranchStates(
      mainState,
      loadInput.factories,
      storedBranches,
      trace,
    ),
  };
};

export type OpenPersistedProjectPhase = FetchProjectPhase | "finalizing";

type OpenPersistedProjectInput = {
  file: File;
  onProgress?: (phase: OpenPersistedProjectPhase) => void;
};

export type OpenPersistedProjectResult =
  | {
      status: "ok";
      hydraulicModel: HydraulicModel;
      projectSettings: ProjectSettings;
      uniqueId: string | null;
    }
  | { status: "too-new"; fileVersion: number; appVersion: number }
  | { status: "corrupt" | "internal"; errorDetails: string }
  | { status: "scenarios-failed"; errorDetails: string }
  | {
      status: "migration-failed";
      errorDetails: string;
      fileVersion: number;
      appVersion: number;
    };

export const useOpenPersistedProject = () => {
  const defaultPanelsFor = useDefaultPanels();
  const isIdPoolsOn = useFeatureFlag("FLAG_ID_POOLS");
  const isPersistScenariosOn = useFeatureFlag("FLAG_PERSIST_SCENARIOS");
  const openPersistedProject = useAtomCallback(
    useCallback(
      async (
        _get,
        set: Setter,
        { file, onProgress }: OpenPersistedProjectInput,
      ): Promise<OpenPersistedProjectResult> => {
        const trace = startTrace("open-project", isTraceProjectOpenOn);
        const result = await trace.measureAsync("open-db", () =>
          db.openProject(file),
        );

        if (result.status !== "ok" && result.status !== "migrated") {
          trace.end();
          return result;
        }

        let uniqueId: string | null = null;
        try {
          uniqueId = await trace.measureAsync("ensure-unique-id", () =>
            db.ensureUniqueId(),
          );
        } catch (error) {
          captureError(error as Error);
        }

        const fetchProject = db.fetchProject;
        const {
          projectSettings,
          zones,
          selectionSets,
          bookmarks,
          hydraulicModel,
          factories,
          simulationSettings,
        } = await trace.measureAsync("fetch-project", () =>
          fetchProject({ onProgress, idPools: isIdPoolsOn }),
        );
        onProgress?.("finalizing");

        const loadInput: ProjectLoadInput = {
          hydraulicModel,
          factories,
          projectSettings,
          zones,
          selectionSets,
          bookmarks,
          simulationSettings,
          autoElevations: projectSettings.projection.type !== "xy-grid",
        };

        let restored: RestoredBranches | null = null;
        if (isPersistScenariosOn) {
          try {
            restored = await restoreBranches(loadInput, trace);
          } catch (error) {
            trace.end();
            captureError(error as Error);
            return {
              status: "scenarios-failed",
              errorDetails: (error as Error).message,
            };
          }
        }

        await trace.measureAsync("clear-simulation-storage", () =>
          clearSimulationStorage(),
        );
        trace.measure("reset-app-state", () =>
          resetAppState(set, defaultPanelsFor()),
        );
        trace.measure("load-model", () => loadModel(set, loadInput));
        if (restored) {
          const { worktree, branchStates } = restored;
          trace.measure("commit-scenarios", () =>
            commitStoredBranches(set, worktree, branchStates),
          );
          set(markProjectSavedAtom);
        }
        trace.end();
        return {
          status: "ok",
          hydraulicModel,
          projectSettings,
          uniqueId,
        };
      },
      [defaultPanelsFor, isIdPoolsOn, isPersistScenariosOn],
    ),
  );

  return { openPersistedProject };
};
