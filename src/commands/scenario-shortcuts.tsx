import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { scenariosAtom, scenariosListAtom } from "src/state/scenarios";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
import { useTranslate } from "src/hooks/use-translate";

export const createScenarioShortcut = "alt+y";
export const cycleScenarioShortcut = "y";
export const toggleScenarioShortcut = "shift+y";

export const useToggleScenario = () => {
  const scenariosState = useAtomValue(scenariosAtom);
  const { switchToMain, switchToScenario } = useScenarioOperations();

  return useCallback(() => {
    const isMainActive = scenariosState.activeScenarioId === null;
    const hasScenarios = scenariosState.scenarios.size > 0;

    if (!hasScenarios) {
      return;
    }

    if (isMainActive) {
      const targetScenarioId =
        scenariosState.lastActiveScenarioId &&
        scenariosState.scenarios.has(scenariosState.lastActiveScenarioId)
          ? scenariosState.lastActiveScenarioId
          : Array.from(scenariosState.scenarios.values()).sort(
              (a, b) => a.createdAt - b.createdAt,
            )[0]?.id;

      if (targetScenarioId) {
        switchToScenario(targetScenarioId);
      }
    } else {
      switchToMain();
    }
  }, [scenariosState, switchToMain, switchToScenario]);
};

export const useCycleScenario = () => {
  const scenariosState = useAtomValue(scenariosAtom);
  const scenariosList = useAtomValue(scenariosListAtom);
  const { switchToScenario } = useScenarioOperations();

  return useCallback(() => {
    const hasScenarios = scenariosList.length > 0;

    if (!hasScenarios) {
      return;
    }

    const currentScenarioId = scenariosState.activeScenarioId;
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
  }, [scenariosState, scenariosList, switchToScenario]);
};

export const useCreateScenario = () => {
  const { createNewScenario } = useScenarioOperations();
  const translate = useTranslate();

  return useCallback(() => {
    const result = createNewScenario();

    notify({
      variant: "success",
      title: translate("scenarios.created"),
      Icon: SuccessIcon,
      duration: 3000,
    });

    return result;
  }, [createNewScenario, translate]);
};
