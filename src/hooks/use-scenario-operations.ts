import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { usePersistenceWithSnapshots, Persistence } from "src/lib/persistence";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import { useDeleteBranch } from "src/hooks/persistence/use-delete-branch";
import { worktreeAtom } from "src/state/scenarios";
import { simulationSettingsAtom } from "src/state/simulation-settings";
import { simulationSettingsDerivedAtom } from "src/state/derived-branch-state";
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
  const { initializeBranch } = useInitializeBranch();
  const { switchBranch } = useSwitchBranch();
  const { deleteBranch } = useDeleteBranch();
  const setWorktree = useSetAtom(worktreeAtom);
  const setMode = useSetAtom(modeAtom);

  const performSwitch = useCallback(
    async (worktree: Worktree, snapshotId: string) => {
      const result = switchToSnapshotFn(worktree, snapshotId);

      if (result.snapshot) {
        if (isStateRefactorOn) {
          switchBranch(result.snapshot.id);
        } else {
          await (persistence as Persistence).applySnapshotDeprecated(
            result.worktree,
            result.snapshot.id,
          );
        }
      }

      setWorktree(result.worktree);

      const targetStatus = isStateRefactorOn
        ? result.worktree.branches.get(snapshotId)?.status
        : result.worktree.snapshots.get(snapshotId)?.status;
      if (targetStatus === "locked") {
        setMode((modeState) => {
          if (DRAWING_MODES.includes(modeState.mode)) {
            return { mode: Mode.NONE };
          }
          return modeState;
        });
      }

      return result;
    },
    [persistence, isStateRefactorOn, switchBranch, setWorktree, setMode],
  );

  const switchToSnapshot = useAtomCallback(
    useCallback(
      (get, _set, snapshotId: string) => {
        const worktree = get(worktreeAtom);
        const updated = isStateRefactorOn
          ? worktree
          : saveSettingsToOutgoingSnapshot(
              worktree,
              get(
                isStateRefactorOn
                  ? simulationSettingsDerivedAtom
                  : simulationSettingsAtom,
              ),
            );
        void performSwitch(updated, snapshotId);
      },
      [performSwitch, isStateRefactorOn],
    ),
  );

  const switchToMain = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
        const updated = isStateRefactorOn
          ? worktree
          : saveSettingsToOutgoingSnapshot(
              worktree,
              get(
                isStateRefactorOn
                  ? simulationSettingsDerivedAtom
                  : simulationSettingsAtom,
              ),
            );
        void performSwitch(updated, updated.mainId);
      },
      [performSwitch, isStateRefactorOn],
    ),
  );

  const createNewScenario = useAtomCallback(
    useCallback(
      async (get, _set) => {
        const worktree = get(worktreeAtom);
        const currentSettings = get(
          isStateRefactorOn
            ? simulationSettingsDerivedAtom
            : simulationSettingsAtom,
        );
        const updated = isStateRefactorOn
          ? worktree
          : saveSettingsToOutgoingSnapshot(worktree, currentSettings);
        const created = createScenario(
          updated,
          currentSettings,
          isStateRefactorOn ? { skipDeltas: true } : undefined,
        );

        if (isStateRefactorOn) {
          const branch: Branch = {
            id: created.scenario.id,
            name: created.scenario.name,
            parentId: updated.mainId,
            status: "open",
          };
          initializeBranch(branch);
          switchBranch(created.scenario.id);

          const result = switchToSnapshotFn(
            created.worktree,
            created.scenario.id,
          );
          setWorktree(result.worktree);
        } else {
          const result = switchToSnapshotFn(
            created.worktree,
            created.scenario.id,
          );

          if (result.snapshot) {
            await (persistence as Persistence).applySnapshotDeprecated(
              result.worktree,
              result.snapshot.id,
            );
          }

          setWorktree(result.worktree);
        }

        return {
          scenarioId: created.scenario.id,
          scenarioName: created.scenario.name,
        };
      },
      [
        persistence,
        isStateRefactorOn,
        initializeBranch,
        switchBranch,
        setWorktree,
      ],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      async (get, set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const updated = isStateRefactorOn
          ? worktree
          : saveSettingsToOutgoingSnapshot(
              worktree,
              get(
                isStateRefactorOn
                  ? simulationSettingsDerivedAtom
                  : simulationSettingsAtom,
              ),
            );
        const result = deleteScenario(updated, scenarioId);

        if (isStateRefactorOn) {
          deleteBranch(scenarioId, result.snapshot?.id ?? null);
        } else {
          persistence.deleteSnapshotFromCache(scenarioId);

          if (result.snapshot) {
            await (persistence as Persistence).applySnapshotDeprecated(
              result.worktree,
              result.snapshot.id,
            );
          }
        }

        setWorktree(result.worktree);
      },
      [persistence, isStateRefactorOn, deleteBranch, setWorktree],
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
