import { useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { CheckoutButton } from "src/components/checkout-button";
import { VideoPlayer } from "src/components/video-player";
import { useActivateTrial } from "src/hooks/use-activate-trial";
import { dialogAtom, type PaywallFeature } from "src/state/dialog";
import { ChevronLeftIcon, RefreshIcon, SuccessIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useAuth, ClerkSignInButton } from "src/auth";
import { buildAfterSignupUrl } from "src/hooks/use-early-access";
import { notify } from "src/components/notifications";

export type FeaturePaywallConfig = {
  feature: PaywallFeature;
  videoSrc: string;
  captions: readonly { start: number; end: number; captionKey: string }[];
  titleKey: string;
  descriptionKeys: string[];
  actionDescriptionKeys: {
    trial: string;
    plans: string;
    demo?: string;
  };
  onTryDemo?: () => Promise<void>;
  onTrialActivated: () => void;
};

export const FeaturePaywall = ({
  config,
  onClose: _onClose,
}: {
  config: FeaturePaywallConfig;
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
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const { activateTrial, isLoading: isTrialLoading } = useActivateTrial();

  const captions = useMemo(
    () =>
      config.captions.map(({ captionKey, ...timing }) => ({
        ...timing,
        text: translate(captionKey),
      })),
    [config.captions, translate],
  );

  const handleClose = () => {
    userTracking.capture({
      name: "paywall.dismissed",
      feature: config.feature,
    });
    _onClose();
  };

  const handleChooseYourPlan = () => {
    userTracking.capture({
      name: "paywall.clickedChoosePlan",
      feature: config.feature,
    });
    setDialog({ type: "upgrade" });
  };

  const handlePersonalCheckout = () => {
    userTracking.capture({
      name: "paywall.clickedPersonal",
      feature: config.feature,
    });
  };

  const handleExplorePlans = () => {
    userTracking.capture({
      name: "paywall.clickedExplorePlans",
      feature: config.feature,
    });
    setShowPlans(true);
  };

  const handleStartTrial = async () => {
    userTracking.capture({
      name: "trial.activated",
      feature: config.feature,
    });
    await activateTrial();

    notify({
      variant: "success",
      title: translate("trial.activated"),
      Icon: SuccessIcon,
      duration: 3000,
    });

    config.onTrialActivated();
  };

  const handleTryDemo = async () => {
    if (!config.onTryDemo) return;
    userTracking.capture({
      name: "paywall.clickedTryDemo",
      feature: config.feature,
    });
    setIsDemoLoading(true);
    try {
      await config.onTryDemo();
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <BaseDialog
      title={translate(config.titleKey)}
      size="lg"
      isOpen={true}
      onClose={handleClose}
    >
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 p-4">
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 border border-gray-200 rounded-lg shadow-md overflow-hidden">
          <VideoPlayer
            src={config.videoSrc}
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
                {config.descriptionKeys.map((key) => (
                  <p
                    key={key}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {translate(key)}
                  </p>
                ))}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate(config.actionDescriptionKeys.trial)}
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
                    {translate("paywall.or")}
                  </span>
                  <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                </div>
                {config.onTryDemo ? (
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
                ) : (
                  <Button
                    variant="default"
                    size="full-width"
                    onClick={handleExplorePlans}
                    disabled={isTrialLoading}
                  >
                    {translate("paywall.explorePlans")}
                  </Button>
                )}
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
                    {translate("paywall.nonCommercial.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {translate("paywall.nonCommercial.description")}
                  </p>
                  <div className="pt-2" onClick={handlePersonalCheckout}>
                    <CheckoutButton
                      plan="personal"
                      paymentType="yearly"
                      variant="default"
                    >
                      {translate("paywall.nonCommercial.cta")}
                    </CheckoutButton>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {translate("paywall.commercial.title")}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {translate("paywall.commercial.description")}
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="full-width"
                      onClick={handleChooseYourPlan}
                    >
                      {translate("paywall.commercial.cta")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 pb-6">
                {config.descriptionKeys.map((key) => (
                  <p
                    key={key}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {translate(key)}
                  </p>
                ))}
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {translate(
                    config.onTryDemo && config.actionDescriptionKeys.demo
                      ? config.actionDescriptionKeys.demo
                      : config.actionDescriptionKeys.plans,
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {config.onTryDemo ? (
                  <>
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
                        {translate("paywall.or")}
                      </span>
                      <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                    </div>
                    <Button
                      variant="primary"
                      size="full-width"
                      onClick={handleExplorePlans}
                      disabled={isDemoLoading}
                    >
                      {translate("paywall.explorePlans")}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="full-width"
                    onClick={handleExplorePlans}
                  >
                    {translate("paywall.explorePlans")}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};
