import { useState } from "react";
import { useSetAtom } from "jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { Button, Loading } from "../elements";
import { CheckoutButton } from "../checkout-button";
import { dialogAtom } from "src/state/dialog";
import { scenariosPromoVideoUrl, supportEmail } from "src/global-config";
import { ScenarioIcon } from "src/icons";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";

export const ScenariosPaywallDialog = ({
  onClose: _onClose,
}: {
  onClose: () => void;
}) => {
  const setDialog = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const handleChooseYourPlan = () => {
    userTracking.capture({ name: "scenariosPaywall.clickedChoosePlan" });
    setDialog({ type: "upgrade" });
  };

  const handlePersonalCheckout = () => {
    userTracking.capture({ name: "scenariosPaywall.clickedPersonal" });
  };

  return (
    <DialogContainer size="lg">
      <DialogHeader
        title={translate("scenarios.paywall.title")}
        titleIcon={ScenarioIcon}
      />
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 py-4">
        <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loading />
            </div>
          )}
          <iframe
            src={scenariosPromoVideoUrl}
            className="w-full h-full border-0"
            onLoad={() => setIsVideoLoading(false)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={translate("scenarios.paywall.title")}
          />
        </div>

        <div className="flex flex-col">
          <p className="text-sm text-gray-700 dark:text-gray-300 pb-6">
            {translate("scenarios.paywall.description")}
          </p>

          <div className="flex flex-col gap-3">
            <div onClick={handlePersonalCheckout}>
              <CheckoutButton
                plan="personal"
                paymentType="yearly"
                variant="primary"
              >
                {translate("scenarios.paywall.supportButton")}
              </CheckoutButton>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {translate("scenarios.paywall.or")}
              </span>
              <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
            </div>

            <Button
              variant="default"
              size="full-width"
              onClick={handleChooseYourPlan}
            >
              {translate("scenarios.paywall.choosePlanButton")}
            </Button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-auto pt-4">
            {translate("scenarios.paywall.needMoreDetails")}{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 underline"
            >
              {translate("scenarios.paywall.contactSales")}
            </a>
          </p>
        </div>
      </div>
    </DialogContainer>
  );
};
