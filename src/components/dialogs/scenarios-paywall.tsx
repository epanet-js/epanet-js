import { useState } from "react";
import { useSetAtom } from "jotai";
import { DialogContainer, DialogHeader } from "../dialog";
import { Button, Loading } from "../elements";
import { CheckoutButton } from "../checkout-button";
import { dialogAtom } from "src/state/dialog";
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
    <DialogContainer size="md">
      <DialogHeader
        title={translate("scenarios.paywall.title")}
        titleIcon={ScenarioIcon}
      />
      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-8 py-4">
        <ScenariosPromoVideo
          isLoading={isVideoLoading}
          onLoad={() => setIsVideoLoading(false)}
        />

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

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {translate("scenarios.paywall.nonCommercial.title")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {translate("scenarios.paywall.nonCommercial.description")}
              </p>
              <div onClick={handlePersonalCheckout}>
                <CheckoutButton
                  plan="personal"
                  paymentType="yearly"
                  variant="default"
                >
                  {translate("scenarios.paywall.nonCommercial.cta")}
                </CheckoutButton>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {translate("scenarios.paywall.commercial.title")}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {translate("scenarios.paywall.commercial.description")}
              </p>
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
      </div>
    </DialogContainer>
  );
};

const ScenariosPromoVideo = ({
  isLoading,
  onLoad,
}: {
  isLoading: boolean;
  onLoad: () => void;
}) => {
  return (
    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loading />
        </div>
      )}
      <iframe
        src="https://player.mux.com/jtnaSrURps7KsyNWdOOt6CypFIcuqfvqT2cGe6wBep4?metadata-video-title=Scenario-paywall-demo&video-title=Scenario-paywall-demo&autoplay=muted&muted=true&loop=true"
        className="w-full h-full border-0"
        onLoad={onLoad}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};
