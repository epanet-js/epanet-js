import { useSetAtom } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { useCallback } from "react";
import type { Worktree } from "@epanet-js/worktree";
import { useInitializeBranch } from "src/hooks/persistence/use-initialize-branch";
import { useSwitchBranch } from "src/hooks/persistence/use-switch-branch";
import { useDeleteBranch } from "src/hooks/persistence/use-delete-branch";
import { useLoadBranch } from "src/hooks/persistence/use-load-branch";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { captureError } from "src/infra/error-tracking";
import { getBranchingRules, getBranchStore } from "src/lib/branching";
import { writeQueue } from "src/lib/persistence/write-queue";
import { useWriteFailureHandler } from "src/hooks/persistence/use-write-failure-handler";
import { branchSwitchInFlightAtom, worktreeAtom } from "src/state/scenarios";
import { branchStateAtom, isBranchLoaded } from "src/state/branch-state";
import { dialogAtom } from "src/state/dialog";
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
  const { loadBranch } = useLoadBranch();
  const isLazyScenariosOn = useFeatureFlag("FLAG_LAZY_SCENARIOS");
  const setWorktree = useSetAtom(worktreeAtom);
  const setMode = useSetAtom(modeAtom);
  const onWriteFailure = useWriteFailureHandler();

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

  const withBranchLoaded = useAtomCallback(
    useCallback(
      async (get, set, branchId: string, then: () => void) => {
        if (get(branchSwitchInFlightAtom)) return;

        set(branchSwitchInFlightAtom, true);
        const state = get(branchStateAtom).get(branchId);
        if (state && !isBranchLoaded(state)) {
          set(dialogAtom, {
            type: "loadingScenario",
            scenarioName: get(worktreeAtom).branches.get(branchId)?.name ?? "",
          });
        }
        try {
          await loadBranch(branchId);
        } catch (error) {
          captureError(error as Error);
          return;
        } finally {
          set(branchSwitchInFlightAtom, false);
          set(dialogAtom, (dialog) =>
            dialog?.type === "loadingScenario" ? null : dialog,
          );
        }
        then();
      },
      [loadBranch],
    ),
  );

  const switchToBranch = useAtomCallback(
    useCallback(
      (get, _set, branchId: string) => {
        if (!isLazyScenariosOn) {
          void performSwitch(get(worktreeAtom), branchId);
          return;
        }
        void withBranchLoaded(branchId, () =>
          performSwitch(get(worktreeAtom), branchId),
        );
      },
      [performSwitch, withBranchLoaded, isLazyScenariosOn],
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

        writeQueue.enqueue(
          () => getBranchStore().createBranch(withScenario, scenario),
          onWriteFailure,
        );

        initializeBranch(scenario);
        switchBranch(scenario.id);

        const switched = getBranchingRules().switchToBranch(
          withScenario,
          scenario.id,
        );
        setWorktree(switched.worktree);

        return { scenarioId: scenario.id, scenarioName: scenario.name };
      },
      [initializeBranch, switchBranch, setWorktree, onWriteFailure],
    ),
  );

  const performDelete = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string) => {
        const worktree = get(worktreeAtom);
        const result = getBranchingRules().deleteBranch(worktree, scenarioId);

        writeQueue.enqueue(
          () => getBranchStore().deleteBranch(scenarioId),
          onWriteFailure,
        );

        deleteBranch(scenarioId, result.nextActive?.id ?? null);

        setWorktree(result.worktree);
      },
      [deleteBranch, setWorktree, onWriteFailure],
    ),
  );

  const deleteScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string) => {
        const { nextActive } = getBranchingRules().deleteBranch(
          get(worktreeAtom),
          scenarioId,
        );
        if (!isLazyScenariosOn || !nextActive) {
          performDelete(scenarioId);
          return;
        }
        void withBranchLoaded(nextActive.id, () => performDelete(scenarioId));
      },
      [performDelete, withBranchLoaded, isLazyScenariosOn],
    ),
  );

  const renameScenarioById = useAtomCallback(
    useCallback(
      (get, _set, scenarioId: string, newName: string) => {
        const worktree = get(worktreeAtom);
        setWorktree(
          getBranchingRules().renameBranch(worktree, scenarioId, newName),
        );
        writeQueue.enqueue(
          () => getBranchStore().renameBranch(scenarioId, newName),
          onWriteFailure,
        );
      },
      [setWorktree, onWriteFailure],
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
