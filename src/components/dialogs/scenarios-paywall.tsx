import { useMemo } from "react";
import { useSetAtom } from "jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { Button } from "../elements";
import { CheckoutButton } from "../checkout-button";
import { VideoPlayer } from "../video-player";
import { useActivateTrial } from "src/hooks/use-activate-trial";
import { dialogAtom } from "src/state/dialog";
import { ScenarioIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useAuth } from "src/auth";

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
  const { user } = useAuth();
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

  const { activateTrial, isLoading: isTrialLoading } = useActivateTrial();

  const handleStartTrial = () => {
    userTracking.capture({
      name: "trial.activated",
      source: "scenariosPaywall",
    });
    void activateTrial();
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
          <div className="space-y-3 pb-6">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {translate("scenarios.paywall.description1")}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {translate("scenarios.paywall.description2")}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {translate("scenarios.paywall.description3")}
            </p>
          </div>

          <div className="flex flex-col gap-5">
            {showTrialButton ? (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Start your 14-day Pro trial
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Try all Pro features free for 14 days. No credit card
                  required.
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="full-width"
                    onClick={handleStartTrial}
                    disabled={isTrialLoading}
                  >
                    Start Free Trial
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </DialogContainer>
  );
};
