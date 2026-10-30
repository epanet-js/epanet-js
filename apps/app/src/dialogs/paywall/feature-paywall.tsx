import { useMemo, type ReactNode } from "react";
import { useSetAtom } from "jotai";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { CheckoutButton } from "src/components/checkout-button";
import { VideoPlayer } from "src/components/video-player";
import {
  trialAfterSignInAtom,
  useActivateTrial,
  useIsTrialEmailRefused,
} from "src/hooks/use-activate-trial";
import { dialogAtom, type PaywallFeature } from "src/state/dialog";
import { RefreshIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useAuth } from "src/hooks/use-auth";
import { SignInButton } from "src/components/auth/sign-in-button";
import { buildAfterSignupUrl } from "src/hooks/use-early-access";
import { isTrialAvailable } from "@epanet-js/account-plans";

export type FeaturePaywallConfig = {
  feature: PaywallFeature;
  imageSrc?: string;
  videoSrc?: string;
  media?: ReactNode;
  captions?: readonly { start: number; end: number; captionKey: string }[];
  titleKey: string;
  descriptionKeys: string[];
  actionDescriptionKeys: {
    trial: string;
    plans: string;
  };
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
  const setTrialAfterSignIn = useSetAtom(trialAfterSignInAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const { user, isSignedIn } = useAuth();
  const isTrialEmailRefused = useIsTrialEmailRefused();
  const showTrialButton = isTrialAvailable(user) && !isTrialEmailRefused;

  const { activateTrial, isLoading: isTrialLoading } = useActivateTrial();

  const captions = useMemo(
    () =>
      (config.captions ?? []).map(({ captionKey, ...timing }) => ({
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

  const handleExplorePlans = () => {
    userTracking.capture({
      name: "paywall.clickedExplorePlans",
      feature: config.feature,
    });
    setDialog({ type: "upgrade", feature: config.feature, source: "paywall" });
  };

  const handleStartTrial = async () => {
    userTracking.capture({
      name: "trial.clickedStart",
      source: "paywall",
      feature: config.feature,
    });
    const activated = await activateTrial();
    if (!activated) return;

    config.onTrialActivated();
  };

  const handleSignInToStartTrial = () => {
    setTrialAfterSignIn(true);
    _onClose();
  };

  return (
    <BaseDialog
      title={translate(config.titleKey)}
      size="lg"
      isOpen={true}
      onClose={handleClose}
    >
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 p-4">
        <div className="relative aspect-square bg-panel border rounded-lg shadow-md overflow-hidden">
          {config.media ? (
            config.media
          ) : config.videoSrc ? (
            <VideoPlayer
              src={config.videoSrc}
              captions={captions}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={config.imageSrc}
              alt={translate(config.titleKey)}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="flex flex-col">
          {showTrialButton ? (
            <>
              <div className="space-y-3 pb-6">
                {config.descriptionKeys.map((key) => (
                  <p key={key} className="text-size-base text-default">
                    {translate(key)}
                  </p>
                ))}
                <p className="text-size-base text-default">
                  {translate(config.actionDescriptionKeys.trial)}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {isSignedIn ? (
                  <Button
                    variant="primary"
                    size="full-width"
                    className="relative"
                    onClick={() => void handleStartTrial()}
                    disabled={isTrialLoading}
                  >
                    <span className={isTrialLoading ? "invisible" : undefined}>
                      {translate("trial.startFree")}
                    </span>
                    {isTrialLoading && (
                      <RefreshIcon className="animate-spin absolute" />
                    )}
                  </Button>
                ) : (
                  <SignInButton
                    forceRedirectUrl={buildAfterSignupUrl("activatingTrial")}
                    signUpForceRedirectUrl={buildAfterSignupUrl(
                      "activatingTrial",
                    )}
                  >
                    <Button
                      variant="primary"
                      size="full-width"
                      onClick={handleSignInToStartTrial}
                    >
                      {translate("trial.startFree")}
                    </Button>
                  </SignInButton>
                )}
                <Button
                  variant="default"
                  size="full-width"
                  onClick={handleExplorePlans}
                  disabled={isTrialLoading}
                >
                  {translate("paywall.explorePlans")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3 pb-6">
                {config.descriptionKeys.map((key) => (
                  <p key={key} className="text-size-base text-default">
                    {translate(key)}
                  </p>
                ))}
                <p className="text-size-base text-default">
                  {translate(config.actionDescriptionKeys.plans)}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <CheckoutButton
                  plan="pro"
                  paymentType="yearly"
                  variant="primary"
                  source="paywall"
                  feature={config.feature}
                >
                  {translate("upgradeTo", "Pro")}
                </CheckoutButton>
              </div>
            </>
          )}
        </div>
      </div>
    </BaseDialog>
  );
};
