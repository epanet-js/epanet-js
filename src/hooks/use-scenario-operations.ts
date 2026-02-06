import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { usePersistenceWithSnapshots, Persistence } from "src/lib/persistence";
import { worktreeAtom } from "src/state/scenarios";
import { modeAtom, Mode } from "src/state/mode";
import {
  createScenario,
  createRevision,
  switchToBranch,
  deleteScenario,
  renameScenario,
  isMainLocked,
} from "src/lib/worktree";
import type { Worktree } from "src/lib/worktree";
import { stagingModelAtom } from "src/state/hydraulic-model";

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
    async (worktree: Worktree, branchId: string) => {
      const result = switchToBranch(worktree, branchId);

      if (result.branch) {
        await (persistence as Persistence).applyBranch(
          result.worktree,
          result.branch.id,
        );
      }

      setWorktree(result.worktree);

      // Disable drawing modes when switching to locked main
      if (branchId === "main" && isMainLocked(result.worktree)) {
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
      (get, _set, branchId: string) => {
        const worktree = get(worktreeAtom);
        void performSwitch(worktree, branchId);
      },
      [performSwitch],
    ),
  );

  const switchToMain = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
        void performSwitch(worktree, "main");
      },
      [performSwitch],
    ),
  );

  const createNewScenario = useAtomCallback(
    useCallback(
      async (get) => {
        const worktree = get(worktreeAtom);
        const created = createScenario(worktree);
        const result = switchToBranch(created.worktree, created.scenario.id);

        if (result.branch) {
          await (persistence as Persistence).applyBranch(
            result.worktree,
            result.branch.id,
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

        if (result.branch) {
          await (persistence as Persistence).applyBranch(
            result.worktree,
            result.branch.id,
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

  const createScenarioFromVersion = useAtomCallback(
    useCallback(
      async (get, _set, versionId: string) => {
        const worktree = get(worktreeAtom);
        const created = createScenario(worktree, versionId);
        const result = switchToBranch(created.worktree, created.scenario.id);

        if (result.branch) {
          await (persistence as Persistence).applyBranch(
            result.worktree,
            result.branch.id,
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

  const createRevisionOnActive = useAtomCallback(
    useCallback(
      (get) => {
        const worktree = get(worktreeAtom);
        const hydraulicModel = get(stagingModelAtom);
        const newWorktree = createRevision(
          worktree,
          worktree.activeBranchId,
          hydraulicModel,
          "",
        );
        (persistence as Persistence).applyRevision(newWorktree);
      },
      [persistence],
    ),
  );

  return {
    switchToSnapshot,
    switchToMain,
    createNewScenario,
    createScenarioFromVersion,
    deleteScenarioById,
    renameScenarioById,
    createRevisionOnActive,
  };
};
