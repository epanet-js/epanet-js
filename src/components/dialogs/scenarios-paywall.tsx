import { useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { Button } from "../elements";
import { CheckoutButton } from "../checkout-button";
import { VideoPlayer } from "../video-player";
import { useActivateTrial } from "src/hooks/use-activate-trial";
import { useScenarioOperations } from "src/hooks/use-scenario-operations";
import { dialogAtom, isDemoNetworkAtom } from "src/state/jotai";
import { userSettingsAtom } from "src/state/user-settings";
import {
  ChevronLeftIcon,
  DisconnectIcon,
  RefreshIcon,
  ScenarioIcon,
  SuccessIcon,
} from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useAuth, ClerkSignInButton } from "src/auth";
import { buildAfterSignupUrl } from "src/hooks/use-early-access";
import { notify } from "src/components/notifications";
import { useImportInp } from "src/commands/import-inp";
import { useUnsavedChangesCheck } from "src/commands/check-unsaved-changes";
import { captureError } from "src/infra/error-tracking";
import { DRUMCHAPEL } from "src/demo/demo-networks";

const SCENARIOS_VIDEO_SRC =
  "https://stream.mux.com/RVxWPZgcfKowXmi00iovKx1sffG100gu21BpD2U6Mjv98.m3u8";

const SCENARIOS_CAPTION_TIMINGS = [
  { start: 0.283, end: 3.283, key: "scenarios.paywall.captions.1" },
  { start: 4.933, end: 10.616, key: "scenarios.paywall.captions.2" },
  { start: 12.066, end: 17.0, key: "scenarios.paywall.captions.3" },
  { start: 19.933, end: 25.4, key: "scenarios.paywall.captions.4" },
  { start: 26.133, end: 30.883, key: "scenarios.paywall.captions.5" },
] as const;

export const ScenariosPaywallDialog = ({
  onClose: _onClose,
}: {
  onClose: () => void;
}) => {
  const setDialog = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { user, isSignedIn } = useAuth();
  const isActivateTrialOn = useFeatureFlag("FLAG_ACTIVATE_TRIAL");
  const showTrialButton =
    isActivateTrialOn && !user.hasUsedTrial && user.plan === "free";
  const captions = useMemo(
    () =>
      SCENARIOS_CAPTION_TIMINGS.map(({ key, ...timing }) => ({
        ...timing,
        text: translate(key),
      })),
    [translate],
  );

  const handleChooseYourPlan = () => {
    userTracking.capture({ name: "scenariosPaywall.clickedChoosePlan" });
    setDialog({ type: "upgrade" });
  };

  const handlePersonalCheckout = () => {
    userTracking.capture({ name: "scenariosPaywall.clickedPersonal" });
  };

  const handleExplorePlans = () => {
    userTracking.capture({ name: "scenariosPaywall.clickedExplorePlans" });
    setShowPlans(true);
  };

  const { activateTrial, isLoading: isTrialLoading } = useActivateTrial();
  const { createNewScenario } = useScenarioOperations();
  const userSettings = useAtomValue(userSettingsAtom);
  const isDemoNetwork = useAtomValue(isDemoNetworkAtom);
  const importInp = useImportInp();
  const checkUnsavedChanges = useUnsavedChangesCheck();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

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
  };

  const handleStartTrial = async () => {
    userTracking.capture({
      name: "trial.activated",
      source: "scenariosPaywall",
    });
    await activateTrial();

    notify({
      variant: "success",
      title: translate("trial.activated"),
      Icon: SuccessIcon,
      duration: 3000,
    });

    if (userSettings.showFirstScenarioDialog) {
      setDialog({
        type: "firstScenario",
        onConfirm: proceedWithCreation,
      });
    } else {
      setDialog(null);
      void proceedWithCreation();
    }
  };

  const handleTryDemo = async () => {
    userTracking.capture({ name: "scenariosPaywall.clickedTryDemo" });
    setIsDemoLoading(true);

    try {
      const response = await fetch(DRUMCHAPEL.url);
      if (!response.ok) throw new Error("Failed to download demo network");

      const name = DRUMCHAPEL.url.split("/").pop()!;
      const file = new File([await response.blob()], name);

      checkUnsavedChanges(async () => {
        await importInp([file]);

        if (userSettings.showFirstScenarioDialog) {
          setDialog({
            type: "firstScenario",
            onConfirm: proceedWithCreation,
          });
        } else {
          void proceedWithCreation();
        }
      });
    } catch (error) {
      captureError(error as Error);
      setIsDemoLoading(false);
      notify({
        variant: "error",
        title: "Could not load demo network",
        Icon: DisconnectIcon,
        size: "md",
      });
    }
  };

  return (
    <DialogContainer size="md">
      <DialogHeader
        title={translate("scenarios.paywall.title")}
        titleIcon={ScenarioIcon}
      />
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 py-4">
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 rounded-lg shadow-md overflow-hidden">
          <VideoPlayer
            src={SCENARIOS_VIDEO_SRC}
            captions={captions}
            autoPlay
            muted
            loop
            playsInline
          />
        </div>

        <div className="flex flex-col">
          {showTrialButton ? (
            <>
              <div className="space-y-3 pb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("scenarios.paywall.description1")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("scenarios.paywall.description2")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("trial.paywallDescription")}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {isSignedIn ? (
                  <Button
                    variant="primary"
                    size="full-width"
                    onClick={() => void handleStartTrial()}
                    disabled={isTrialLoading || isDemoLoading}
                  >
                    {isTrialLoading ? (
                      <RefreshIcon className="animate-spin" />
                    ) : (
                      translate("trial.activateFree")
                    )}
                  </Button>
                ) : (
                  <ClerkSignInButton
                    forceRedirectUrl={buildAfterSignupUrl("activatingTrial")}
                    signUpForceRedirectUrl={buildAfterSignupUrl(
                      "activatingTrial",
                    )}
                  >
                    <Button
                      variant="primary"
                      size="full-width"
                      disabled={isDemoLoading}
                    >
                      {translate("trial.activateFree")}
                    </Button>
                  </ClerkSignInButton>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    or
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>
                <Button
                  variant="default"
                  size="full-width"
                  onClick={() => void handleTryDemo()}
                  disabled={isTrialLoading || isDemoLoading}
                >
                  {isDemoLoading ? (
                    <RefreshIcon className="animate-spin" />
                  ) : (
                    translate("trial.tryWithDemo")
                  )}
                </Button>
              </div>
            </>
          ) : showPlans ? (
            <>
              <button
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 pb-2"
                onClick={() => setShowPlans(false)}
              >
                <ChevronLeftIcon className="w-4 h-4" />
                {translate("back")}
              </button>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {translate("scenarios.paywall.nonCommercial.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {translate("scenarios.paywall.nonCommercial.description")}
                  </p>
                  <div className="pt-2" onClick={handlePersonalCheckout}>
                    <CheckoutButton
                      plan="personal"
                      paymentType="yearly"
                      variant="default"
                    >
                      {translate("scenarios.paywall.nonCommercial.cta")}
                    </CheckoutButton>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {translate("scenarios.paywall.commercial.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {translate("scenarios.paywall.commercial.description")}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="full-width"
                      onClick={handleChooseYourPlan}
                    >
                      {translate("scenarios.paywall.commercial.cta")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 pb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("scenarios.paywall.description1")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("scenarios.paywall.description2")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("scenarios.paywall.description3Demo")}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  variant="default"
                  size="full-width"
                  onClick={() => void handleTryDemo()}
                  disabled={isDemoLoading}
                >
                  {isDemoLoading ? (
                    <RefreshIcon className="animate-spin" />
                  ) : (
                    translate("trial.tryWithDemo")
                  )}
                </Button>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    or
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>
                <Button
                  variant="primary"
                  size="full-width"
                  onClick={handleExplorePlans}
                  disabled={isDemoLoading}
                >
                  {translate("scenarios.paywall.explorePlans")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DialogContainer>
  );
};
