import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { scenariosListAtom } from "src/state/scenarios";
import {
  dialogAtom,
  isDemoNetworkAtom,
  simulationAtom,
  stagingModelAtom,
} from "src/state/jotai";
import { useAuth } from "src/auth";
import { limits } from "src/user-plan";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { notify } from "src/components/notifications";
import { SuccessIcon } from "src/icons";
import { useRunSimulation } from "./run-simulation";
import { userSettingsAtom } from "src/state/user-settings";
export const createScenarioShortcut = "alt+y";

export const useCreateScenario = () => {
  const { createNewScenario } = useScenarioOperations();
  const scenariosList = useAtomValue(scenariosListAtom);
  const setDialog = useSetAtom(dialogAtom);
  const { user } = useAuth();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const simulation = useAtomValue(simulationAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
  const runSimulation = useRunSimulation();
  const userSettings = useAtomValue(userSettingsAtom);
  const isDemoNetwork = useAtomValue(isDemoNetworkAtom);

  return useCallback(
    ({ source: _source }: { source: string }) => {
      const isFirstTimeEnabling = scenariosList.length === 0;
      const shouldBypassPaywall = isDemoNetwork;

      if (
        isFirstTimeEnabling &&
        !limits.canUseScenarios(user.plan) &&
        !shouldBypassPaywall
      ) {
        setDialog({ type: "scenariosPaywall" });
        userTracking.capture({ name: "scenariosPaywall.triggered" });
        return null;
      }

      const hasAssets = hydraulicModel.assets.size > 0;
      if (isFirstTimeEnabling && !hasAssets) {
        setDialog({ type: "alertNetworkRequired" });
        return null;
      }

      const proceedWithCreation = async () => {
        const { scenarioId, scenarioName } = await createNewScenario();

        userTracking.capture({
          name: "scenario.created",
          scenarioId,
          scenarioName,
          isDemoNetwork,
        });

        notify({
          variant: "success",
          title: translate("scenarios.created"),
          Icon: SuccessIcon,
          duration: 3000,
        });

        return { scenarioId, scenarioName };
      };

      const showDialogOrProceed = () => {
        if (userSettings.showFirstScenarioDialog) {
          setDialog({
            type: "firstScenario",
            onConfirm: proceedWithCreation,
          });
          return null;
        }
        void proceedWithCreation();
        return null;
      };

      if (isFirstTimeEnabling) {
        const isSimulationUpToDate =
          simulation.status !== "idle" &&
          simulation.status !== "running" &&
          simulation.modelVersion === hydraulicModel.version;

        if (!isSimulationUpToDate) {
          void runSimulation({
            onContinue: showDialogOrProceed,
            onIgnore: showDialogOrProceed,
            ignoreLabel: translate("scenarios.ignoreAndCreate"),
          });
          return null;
        }

        return showDialogOrProceed();
      }

      void proceedWithCreation();
      return null;
    },
    [
      createNewScenario,
      scenariosList,
      setDialog,
      user,
      userTracking,
      translate,
      simulation,
      hydraulicModel,
      runSimulation,
      userSettings,
      isDemoNetwork,
    ],
  );
};
