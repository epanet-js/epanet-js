import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import { useDeleteBranch } from "src/hooks/persistence/use-delete-branch";
import { worktreeAtom } from "src/state/scenarios";
import { modeAtom, Mode } from "src/state/mode";
import {
  createScenario,
  switchToBranch as switchToBranchFn,
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
  const { initializeBranch } = useInitializeBranch();
  const { switchBranch } = useSwitchBranch();
  const { deleteBranch } = useDeleteBranch();
  const setWorktree = useSetAtom(worktreeAtom);
  const setMode = useSetAtom(modeAtom);

  const performSwitch = useCallback(
    (worktree: Worktree, branchId: string) => {
      const result = switchToBranchFn(worktree, branchId);

      if (result.branch) {
        switchBranch(result.branch.id);
      }

      setWorktree(result.worktree);

      const targetStatus = result.worktree.branches.get(branchId)?.status;
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
    [switchBranch, setWorktree, setMode],
  );

  const switchToBranch = useAtomCallback(
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
        void performSwitch(worktree, worktree.mainId);
      },
      [performSwitch],
    ),
  );

  const createNewScenario = useAtomCallback(
    useCallback(
      (get, _set) => {
        const worktree = get(worktreeAtom);
        const created = createScenario(worktree);

        initializeBranch(created.branch);
        switchBranch(created.branch.id);

        const result = switchToBranchFn(created.worktree, created.branch.id);
        setWorktree(result.worktree);

        return {
          scenarioId: created.branch.id,
          scenarioName: created.branch.name,
        };
      },
      [initializeBranch, switchBranch, setWorktree],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      (get, set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const result = deleteScenario(worktree, scenarioId);

        deleteBranch(scenarioId, result.branch?.id ?? null);

        setWorktree(result.worktree);
      },
      [deleteBranch, setWorktree],
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
    switchToBranch,
    switchToMain,
    createNewScenario,
    deleteScenarioById,
    renameScenarioById,
  };
};
