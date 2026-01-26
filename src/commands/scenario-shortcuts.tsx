import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { worktreeAtom, scenariosListAtom } from "src/state/scenarios";

export const cycleScenarioShortcut = "y";
export const toggleScenarioShortcut = "shift+y";

export const useToggleScenario = () => {
  const worktree = useAtomValue(worktreeAtom);
  const { switchToMain, switchToScenario } = useScenarioOperations();

  return useCallback(() => {
    const isMainActive = worktree.activeScenarioId === null;
    const hasScenarios = worktree.scenarios.size > 0;

    if (!hasScenarios) {
      return;
    }

    if (isMainActive) {
      const targetScenarioId =
        worktree.lastActiveScenarioId &&
        worktree.scenarios.has(worktree.lastActiveScenarioId)
          ? worktree.lastActiveScenarioId
          : Array.from(worktree.scenarios.values())[0]?.id;

      if (targetScenarioId) {
        switchToScenario(targetScenarioId);
      }
    } else {
      switchToMain();
    }
  }, [worktree, switchToMain, switchToScenario]);
};

export const useCycleScenario = () => {
  const worktree = useAtomValue(worktreeAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const { switchToScenario } = useScenarioOperations();

  return useCallback(() => {
    const hasScenarios = scenariosList.length > 0;

    if (!hasScenarios) {
      return;
    }

    const currentScenarioId = worktree.activeScenarioId;
    const isMainActive = currentScenarioId === null;

    if (isMainActive) {
      switchToScenario(scenariosList[0].id);
    } else {
      const currentIndex = scenariosList.findIndex(
        (s) => s.id === currentScenarioId,
      );
      const nextIndex = (currentIndex + 1) % scenariosList.length;
      switchToScenario(scenariosList[nextIndex].id);
    }
  }, [worktree, scenariosList, switchToScenario]);
};
