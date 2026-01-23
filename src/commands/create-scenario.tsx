import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { scenariosListAtom } from "src/state/scenarios";
import { dialogAtom } from "src/state/jotai";
import { useAuth } from "src/auth";
import { limits } from "src/user-plan";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";

export const createScenarioShortcut = "alt+y";

export const useCreateScenario = () => {
  const { createNewScenario } = useScenarioOperations();
  const scenariosList = useAtomValue(scenariosListAtom);
  const setDialog = useSetAtom(dialogAtom);
  const { user } = useAuth();
  const userTracking = useUserTracking();
  const translate = useTranslate();

  return useCallback(
    ({ source: _source }: { source: string }) => {
      const isFirstTimeEnabling = scenariosList.length === 0;

      if (isFirstTimeEnabling && !limits.canUseScenarios(user.plan)) {
        setDialog({ type: "scenariosPaywall" });
        userTracking.capture({ name: "scenariosPaywall.triggered" });
        return null;
      }

      const { scenarioId, scenarioName } = createNewScenario();

      userTracking.capture({
        name: "scenario.created",
        scenarioId,
        scenarioName,
      });

      notify({
        variant: "success",
        title: translate("scenarios.created"),
        Icon: SuccessIcon,
        duration: 3000,
      });

      return { scenarioId, scenarioName };
    },
    [
      createNewScenario,
      scenariosList,
      setDialog,
      user,
      userTracking,
      translate,
    ],
  );
};
