import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { usePersistenceWithSnapshots, Persistence } from "src/lib/persistence";
import { worktreeAtom } from "src/state/scenarios";
import { modeAtom, Mode } from "src/state/mode";
import {
  createScenario,
  switchToSnapshot as switchToSnapshotFn,
  deleteScenario,
  renameScenario,
} from "src/lib/worktree";
import type { Worktree } from "src/lib/worktree";

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

export const useScenarioOperations = () => {
  const persistence = usePersistenceWithSnapshots();
  const setWorktree = useSetAtom(worktreeAtom);
  const setMode = useSetAtom(modeAtom);

  const performSwitch = useCallback(
    async (worktree: Worktree, snapshotId: string) => {
      const result = switchToSnapshotFn(worktree, snapshotId);

      if (result.snapshot) {
        await (persistence as Persistence).applySnapshot(
          result.worktree,
          result.snapshot.id,
        );
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
    [persistence, setWorktree, setMode],
  );

  const switchToSnapshot = useAtomCallback(
    useCallback(
      (get, _set, snapshotId: string) => {
        const worktree = get(worktreeAtom);
        void performSwitch(worktree, snapshotId);
      },
      [performSwitch],
    ),
  );

  const switchToMain = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
        void performSwitch(worktree, worktree.mainId);
      },
      [performSwitch],
    ),
  );

  const createNewScenario = useAtomCallback(
    useCallback(
      async (get) => {
        const worktree = get(worktreeAtom);
        const created = createScenario(worktree);
        const result = switchToSnapshotFn(
          created.worktree,
          created.scenario.id,
        );

        if (result.snapshot) {
          await (persistence as Persistence).applySnapshot(
            result.worktree,
            result.snapshot.id,
          );
        }

        setWorktree(result.worktree);

        return {
          scenarioId: created.scenario.id,
          scenarioName: created.scenario.name,
        };
      },
      [persistence, setWorktree],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      async (get, _set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const result = deleteScenario(worktree, scenarioId);

        persistence.deleteSnapshotFromCache(scenarioId);

        if (result.snapshot) {
          await (persistence as Persistence).applySnapshot(
            result.worktree,
            result.snapshot.id,
          );
        }

        setWorktree(result.worktree);
      },
      [persistence, setWorktree],
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
