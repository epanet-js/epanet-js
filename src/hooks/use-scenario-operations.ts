import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { usePersistenceWithSnapshots, Persistence } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useApplySnapshot } from "src/hooks/persistence/use-apply-snapshot";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { copyModel } from "src/hydraulic-model";
import { LabelManager } from "src/hydraulic-model/label-manager";
import { worktreeAtom } from "src/state/scenarios";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { modelCacheAtom } from "src/state/model-cache";
import { modelFactoriesAtom } from "src/state/model-factories";
import { modeAtom, Mode } from "src/state/mode";
import {
  createScenario,
  switchToSnapshot as switchToSnapshotFn,
  deleteScenario,
  renameScenario,
} from "src/lib/worktree";
import type { Worktree, Branch } from "src/lib/worktree";
import type { SimulationSettings } from "src/simulation/simulation-settings";

const DRAWING_MODES: Mode[] = [
  Mode.DRAW_JUNCTION,
  Mode.DRAW_PIPE,
  Mode.DRAW_RESERVOIR,
  Mode.DRAW_PUMP,
  Mode.DRAW_VALVE,
  Mode.DRAW_TANK,
  Mode.CONNECT_CUSTOMER_POINTS,
  Mode.REDRAW_LINK,
];

const saveSettingsToOutgoingSnapshot = (
  worktree: Worktree,
  currentSettings: SimulationSettings,
): Worktree => {
  const currentSnapshot = worktree.snapshots.get(worktree.activeSnapshotId);
  if (!currentSnapshot) return worktree;

  const updatedSnapshots = new Map(worktree.snapshots);
  updatedSnapshots.set(worktree.activeSnapshotId, {
    ...currentSnapshot,
    simulationSettings: currentSettings,
  });
  return { ...worktree, snapshots: updatedSnapshots };
};

export const useScenarioOperations = () => {
  const persistence = usePersistenceWithSnapshots();
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const { applySnapshot } = useApplySnapshot();
  const { initializeBranch } = useInitializeBranch();
  const setWorktree = useSetAtom(worktreeAtom);
  const setMode = useSetAtom(modeAtom);

  const performSwitch = useCallback(
    async (worktree: Worktree, snapshotId: string) => {
      const result = switchToSnapshotFn(worktree, snapshotId);

      if (result.snapshot) {
        if (isStateRefactorOn) {
          await applySnapshot(result.worktree, result.snapshot.id);
        } else {
          await (persistence as Persistence).applySnapshotDeprecated(
            result.worktree,
            result.snapshot.id,
          );
        }
      }

      setWorktree(result.worktree);

      const targetSnapshot = result.worktree.snapshots.get(snapshotId);
      if (targetSnapshot?.status === "locked") {
        setMode((modeState) => {
          if (DRAWING_MODES.includes(modeState.mode)) {
            return { mode: Mode.NONE };
          }
          return modeState;
        });
      }

      return result;
    },
    [persistence, isStateRefactorOn, applySnapshot, setWorktree, setMode],
  );

  const switchToSnapshot = useAtomCallback(
    useCallback(
      (get, _set, snapshotId: string) => {
        const worktree = get(worktreeAtom);
        const currentSettings = get(simulationSettingsAtom);
        const updated = saveSettingsToOutgoingSnapshot(
          worktree,
          currentSettings,
        );
        void performSwitch(updated, snapshotId);
      },
      [performSwitch],
    ),
  );

  const switchToMain = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
        const currentSettings = get(simulationSettingsAtom);
        const updated = saveSettingsToOutgoingSnapshot(
          worktree,
          currentSettings,
        );
        void performSwitch(updated, updated.mainId);
      },
      [performSwitch],
    ),
  );

  const createNewScenario = useAtomCallback(
    useCallback(
      async (get, set) => {
        const worktree = get(worktreeAtom);
        const currentSettings = get(simulationSettingsAtom);
        const updated = saveSettingsToOutgoingSnapshot(
          worktree,
          currentSettings,
        );
        const created = createScenario(
          updated,
          currentSettings,
          isStateRefactorOn ? { skipDeltas: true } : undefined,
        );

        if (isStateRefactorOn) {
          const currentCache = get(modelCacheAtom);
          const mainEntry = currentCache.get(updated.mainId);
          if (mainEntry) {
            const factories = get(modelFactoriesAtom);
            const newCache = new Map(currentCache);
            newCache.set(created.scenario.id, {
              model: copyModel(mainEntry.model),
              labelManager: new LabelManager(new Map(factories.labelCounters)),
            });
            set(modelCacheAtom, newCache);
          }

          const branch: Branch = {
            id: created.scenario.id,
            name: created.scenario.name,
            parentId: updated.mainId,
            status: "open",
          };
          initializeBranch(branch);
        }

        const result = switchToSnapshotFn(
          created.worktree,
          created.scenario.id,
        );

        if (result.snapshot) {
          if (isStateRefactorOn) {
            await applySnapshot(result.worktree, result.snapshot.id);
          } else {
            await (persistence as Persistence).applySnapshotDeprecated(
              result.worktree,
              result.snapshot.id,
            );
          }
        }

        setWorktree(result.worktree);

        return {
          scenarioId: created.scenario.id,
          scenarioName: created.scenario.name,
        };
      },
      [
        persistence,
        isStateRefactorOn,
        applySnapshot,
        initializeBranch,
        setWorktree,
      ],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      async (get, set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const currentSettings = get(simulationSettingsAtom);
        const updated = saveSettingsToOutgoingSnapshot(
          worktree,
          currentSettings,
        );
        const result = deleteScenario(updated, scenarioId);

        if (isStateRefactorOn) {
          const cache = new Map(get(modelCacheAtom));
          cache.delete(scenarioId);
          set(modelCacheAtom, cache);
        } else {
          persistence.deleteSnapshotFromCache(scenarioId);
        }

        if (result.snapshot) {
          if (isStateRefactorOn) {
            await applySnapshot(result.worktree, result.snapshot.id);
          } else {
            await (persistence as Persistence).applySnapshotDeprecated(
              result.worktree,
              result.snapshot.id,
            );
          }
        }

        setWorktree(result.worktree);
      },
      [persistence, isStateRefactorOn, applySnapshot, setWorktree],
    ),
  );

  const renameScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string, newName: string) => {
        const worktree = get(worktreeAtom);
        setWorktree(renameScenario(worktree, scenarioId, newName));
      },
      [setWorktree],
    ),
  );

  return {
    switchToSnapshot,
    switchToMain,
    createNewScenario,
    deleteScenarioById,
    renameScenarioById,
  };
};
