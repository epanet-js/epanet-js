import { useCallback } from "react";
import { useAtomValue } from "jotai";
import { useAtomCallback } from "jotai/utils";
import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { useImportInp } from "src/commands/import-inp";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { useRunSimulation } from "src/commands/run-simulation";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { isDemoNetworkAtom } from "src/state/file-system";
import {
  stagingModelDerivedAtom,
  simulationDerivedAtom,
} from "src/state/derived-branch-state";
import { userSettingsAtom } from "src/state/user-settings";
import { dialogAtom } from "src/state/dialog";
import { useSetAtom } from "jotai";
import { SuccessIcon, DisconnectIcon } from "src/icons";
import { notify } from "src/components/notifications";
import { captureError } from "src/infra/error-tracking";
import { DRUMCHAPEL } from "src/demo/demo-networks";

const SCENARIOS_VIDEO_SRC =
  "https://stream.mux.com/RVxWPZgcfKowXmi00iovKx1sffG100gu21BpD2U6Mjv98.m3u8";

const SCENARIOS_CAPTIONS = [
  { start: 0.283, end: 3.283, captionKey: "scenarios.paywall.captions.1" },
  { start: 4.933, end: 10.616, captionKey: "scenarios.paywall.captions.2" },
  { start: 12.066, end: 17.0, captionKey: "scenarios.paywall.captions.3" },
  { start: 19.933, end: 25.4, captionKey: "scenarios.paywall.captions.4" },
  { start: 26.133, end: 30.883, captionKey: "scenarios.paywall.captions.5" },
] as const;

export const ScenariosPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const setDialog = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { createNewScenario } = useScenarioOperations();
  const isDemoNetwork = useAtomValue(isDemoNetworkAtom);
  const userSettings = useAtomValue(userSettingsAtom);
  const importInp = useImportInp();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const runSimulation = useRunSimulation();

  const proceedWithCreation = useCallback(() => {
    const { scenarioId, scenarioName } = createNewScenario();
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
  }, [createNewScenario, userTracking, isDemoNetwork, translate]);

  const showDialogOrProceed = useCallback(() => {
    if (userSettings.showFirstScenarioDialog) {
      setDialog({ type: "firstScenario", onConfirm: proceedWithCreation });
      return;
    }
    void proceedWithCreation();
  }, [userSettings.showFirstScenarioDialog, setDialog, proceedWithCreation]);

  const runSimulationThenProceed = useAtomCallback(
    useCallback(
      (get) => {
        const simulation = get(simulationDerivedAtom);
        const hydraulicModel = get(stagingModelDerivedAtom);

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
          return;
        }
        showDialogOrProceed();
      },
      [runSimulation, showDialogOrProceed, translate],
    ),
  );

  const handleTryDemo = useCallback(async () => {
    const response = await fetch(DRUMCHAPEL.url);
    if (!response.ok) throw new Error("Failed to download demo network");

    const name = DRUMCHAPEL.url.split("/").pop()!;
    const file = new File([await response.blob()], name);

    checkUnsavedChanges(async () => {
      await importInp([file], "scenariosPaywall");
      runSimulationThenProceed();
    });
  }, [checkUnsavedChanges, importInp, runSimulationThenProceed]);

  const handleTryDemoWithErrorHandling = useCallback(async () => {
    try {
      await handleTryDemo();
    } catch (error) {
      captureError(error as Error);
      notify({
        variant: "error",
        title: "Could not load demo network",
        Icon: DisconnectIcon,
        size: "md",
      });
    }
  }, [handleTryDemo]);

  const config: FeaturePaywallConfig = {
    feature: "scenarios",
    videoSrc: SCENARIOS_VIDEO_SRC,
    captions: SCENARIOS_CAPTIONS,
    titleKey: "scenarios.paywall.title",
    descriptionKeys: [
      "scenarios.paywall.description1",
      "scenarios.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "scenarios.paywall.trial",
      plans: "scenarios.paywall.plans",
      demo: "scenarios.paywall.demo",
    },
    onTryDemo: handleTryDemoWithErrorHandling,
    onTrialActivated: runSimulationThenProceed,
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
