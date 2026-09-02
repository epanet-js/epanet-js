import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import type { Worktree } from "@epanet-js/worktree";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import { useDeleteBranch } from "src/hooks/persistence/use-delete-branch";
import { getBranchingRules } from "src/lib/branching";
import { worktreeAtom } from "src/state/scenarios";
import { modeAtom, Mode } from "src/state/mode";

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
      const result = getBranchingRules().switchToBranch(worktree, branchId);

      if (result.activated) {
        switchBranch(result.activated.id);
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
        const { worktree: withScenario, created: scenario } =
          getBranchingRules().createBranch(worktree);
        if (!scenario) return null;

        initializeBranch(scenario);
        switchBranch(scenario.id);

        const switched = getBranchingRules().switchToBranch(
          withScenario,
          scenario.id,
        );
        setWorktree(switched.worktree);

        return { scenarioId: scenario.id, scenarioName: scenario.name };
      },
      [initializeBranch, switchBranch, setWorktree],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const result = getBranchingRules().deleteBranch(worktree, scenarioId);

        deleteBranch(scenarioId, result.nextActive?.id ?? null);

        setWorktree(result.worktree);
      },
      [deleteBranch, setWorktree],
    ),
  );

  const renameScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string, newName: string) => {
        const worktree = get(worktreeAtom);
        setWorktree(
          getBranchingRules().renameBranch(worktree, scenarioId, newName),
        );
      },
      [setWorktree],
    ),
  );

  return {
    scenariosAvailable: getBranchingRules().isAvailable,
    switchToBranch,
    switchToMain,
    createNewScenario,
    deleteScenarioById,
    renameScenarioById,
  };
};
