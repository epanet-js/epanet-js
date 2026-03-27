import { useState } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog } from "../components/dialog";
import { Button } from "../components/elements";
import { CheckoutButton } from "../components/checkout-button";
import { VideoPlayer } from "../components/video-player";
import { useActivateTrial } from "src/hooks/use-activate-trial";
import { dialogAtom } from "src/state/dialog";
import { ChevronLeftIcon, RefreshIcon, SuccessIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useAuth, ClerkSignInButton } from "src/auth";
import { buildAfterSignupUrl } from "src/hooks/use-early-access";
import { notify } from "src/components/notifications";
import { useMemo } from "react";

const ELEVATIONS_VIDEO_SRC =
  "https://stream.mux.com/ELEVATIONS_VIDEO_PLACEHOLDER.m3u8";

const ELEVATIONS_CAPTION_TIMINGS = [
  { start: 0.283, end: 3.283, key: "elevations.paywall.captions.1" },
  { start: 4.933, end: 10.616, key: "elevations.paywall.captions.2" },
  { start: 12.066, end: 17.0, key: "elevations.paywall.captions.3" },
  { start: 19.933, end: 25.4, key: "elevations.paywall.captions.4" },
] as const;

export const ElevationsPaywallDialog = ({
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
  const [showPlans, setShowPlans] = useState(false);

  const handleClose = () => {
    userTracking.capture({ name: "elevationsPaywall.dismissed" });
    _onClose();
  };

  const captions = useMemo(
    () =>
      ELEVATIONS_CAPTION_TIMINGS.map(({ key, ...timing }) => ({
        ...timing,
        text: translate(key),
      })),
    [translate],
  );

  const handleChooseYourPlan = () => {
    userTracking.capture({ name: "elevationsPaywall.clickedChoosePlan" });
    setDialog({ type: "upgrade" });
  };

  const handlePersonalCheckout = () => {
    userTracking.capture({ name: "elevationsPaywall.clickedPersonal" });
  };

  const handleExplorePlans = () => {
    userTracking.capture({ name: "elevationsPaywall.clickedExplorePlans" });
    setShowPlans(true);
  };

  const { activateTrial, isLoading: isTrialLoading } = useActivateTrial();

  const handleStartTrial = async () => {
    userTracking.capture({
      name: "trial.activated",
      source: "elevationsPaywall",
    });
    await activateTrial();

    notify({
      variant: "success",
      title: translate("trial.activated"),
      Icon: SuccessIcon,
      duration: 3000,
    });

    _onClose();
  };

  return (
    <BaseDialog
      title={translate("elevations.paywall.title")}
      size="lg"
      isOpen={true}
      onClose={handleClose}
    >
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 p-4">
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 rounded-lg shadow-md overflow-hidden">
          <VideoPlayer
            src={ELEVATIONS_VIDEO_SRC}
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
                  {translate("elevations.paywall.description1")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("elevations.paywall.description2")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("trial.paywallDescriptionElevations")}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {isSignedIn ? (
                  <Button
                    variant="primary"
                    size="full-width"
                    onClick={() => void handleStartTrial()}
                    disabled={isTrialLoading}
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
                    <Button variant="primary" size="full-width">
                      {translate("trial.activateFree")}
                    </Button>
                  </ClerkSignInButton>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {translate("elevations.paywall.or")}
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>
                <Button
                  variant="default"
                  size="full-width"
                  onClick={handleExplorePlans}
                  disabled={isTrialLoading}
                >
                  {translate("elevations.paywall.explorePlans")}
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
                    {translate("elevations.paywall.nonCommercial.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {translate("elevations.paywall.nonCommercial.description")}
                  </p>
                  <div className="pt-2" onClick={handlePersonalCheckout}>
                    <CheckoutButton
                      plan="personal"
                      paymentType="yearly"
                      variant="default"
                    >
                      {translate("elevations.paywall.nonCommercial.cta")}
                    </CheckoutButton>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {translate("elevations.paywall.commercial.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {translate("elevations.paywall.commercial.description")}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="full-width"
                      onClick={handleChooseYourPlan}
                    >
                      {translate("elevations.paywall.commercial.cta")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 pb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("elevations.paywall.description1")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("elevations.paywall.description2")}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate("elevations.paywall.description3")}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  variant="primary"
                  size="full-width"
                  onClick={handleExplorePlans}
                >
                  {translate("elevations.paywall.explorePlans")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};
