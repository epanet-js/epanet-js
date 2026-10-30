import { useSetAtom } from "jotai";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { dialogAtom } from "src/state/dialog";
import {
  buildAfterSignupUrl,
  useEarlyAccess,
} from "src/hooks/use-early-access";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useStartUpgrade } from "src/hooks/use-paywall";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { CheckIcon, CloseIcon, WarningIcon } from "src/icons";
import { FeaturesList } from "./upgrade";

export const ModelBuilderLegacyPaywallDialog = ({
  source,
  onClose,
}: {
  source: string;
  onClose: () => void;
}) => {
  const setDialog = useSetAtom(dialogAtom);
  const onlyEarlyAccess = useEarlyAccess();
  const userTracking = useUserTracking();
  const translate = useTranslate();
  const startUpgrade = useStartUpgrade();
  const isModelBuilderPaywallOn = useFeatureFlag("FLAG_MODEL_BUILDER_PAYWALL");

  const comparedFeatures = isModelBuilderPaywallOn
    ? [
        { legacy: "Pipe year and materials", pro: "Pipe year and materials" },
        { legacy: "Custom attributes", pro: "Custom attributes" },
        { legacy: "Zones", pro: "Zones" },
        { legacy: "Customer points", pro: "Customer points" },
        {
          legacy: "Filter, split by value and custom rules",
          pro: "Filter, split by value and custom rules",
        },
        { legacy: "Multiple files per layer", pro: "Multiple files per layer" },
        { legacy: "DXF and CSV files", pro: "DXF and CSV files" },
        { legacy: "Models over 100K assets", pro: "Models over 100K assets" },
        {
          legacy: translate("modelBuilderPaywall.legacyProjection"),
          pro: translate("modelBuilderPaywall.proProjection"),
        },
        {
          legacy: translate("modelBuilderPaywall.legacyLanguages"),
          pro: translate("modelBuilderPaywall.proLanguages"),
        },
      ]
    : [
        {
          legacy: translate("modelBuilderPaywall.pipeYearAndMaterials"),
          pro: translate("modelBuilderPaywall.pipeYearAndMaterials"),
        },
        {
          legacy: translate("modelBuilderPaywall.legacyProjection"),
          pro: translate("modelBuilderPaywall.proProjection"),
        },
        {
          legacy: translate("modelBuilderPaywall.legacyLanguages"),
          pro: translate("modelBuilderPaywall.proLanguages"),
        },
        {
          legacy: translate("modelBuilderPaywall.customAttributes"),
          pro: translate("modelBuilderPaywall.customAttributes"),
        },
      ];

  const upcomingFeatures = isModelBuilderPaywallOn
    ? [translate("modelBuilderPaywall.saveBuildSettings")]
    : [
        translate("modelBuilderPaywall.saveBuildSettings"),
        translate("modelBuilderPaywall.filterData"),
      ];

  const handleDismiss = () => {
    userTracking.capture({ name: "modelBuilder.paywall.dismissed", source });
    onClose();
  };

  const handleContinueWithLegacy = () => {
    userTracking.capture({
      name: "modelBuilder.paywall.continuedWithLegacy",
      source,
    });
    onlyEarlyAccess(() => {
      userTracking.capture({ name: "modelBuilder.opened", source });
      setDialog({ type: "modelBuilderLegacyIframe" });
    }, buildAfterSignupUrl("modelBuilderLegacyIframe"));
  };

  const handleUpgrade = () => {
    userTracking.capture({
      name: "modelBuilder.paywall.upgradeClicked",
      source,
    });
    startUpgrade("modelBuilder");
  };

  return (
    <BaseDialog
      title={translate("modelBuilderPaywall.title")}
      size="lg"
      isOpen={true}
      onClose={handleDismiss}
    >
      <div className="p-4">
        <p className="text-size-base text-default pb-6">
          {translate("modelBuilderPaywall.subtitle")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-base border rounded-md shadow-md overflow-hidden flex flex-col justify-between">
            <div className="p-6 flex flex-col flex-1">
              <h2 className="text-size-heading-2 font-semibold mb-2">
                {translate("modelBuilderPaywall.legacy")}
              </h2>
              {isModelBuilderPaywallOn && (
                <p className="text-size-base text-subtle">
                  Free and Personal plans
                </p>
              )}
              <div className="flex flex-col justify-between flex-1">
                <FeaturesList
                  items={[
                    {
                      feature: translate("modelBuilderPaywall.maintenanceOnly"),
                      Icon: WarningIcon,
                      iconColor: "text-warning",
                    },
                    ...comparedFeatures.map(({ legacy }) => ({
                      feature: legacy,
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    })),
                  ]}
                />
                {!isModelBuilderPaywallOn && (
                  <FeaturesList
                    title={translate("modelBuilderPaywall.notAvailable")}
                    textColor="text-subtle"
                    items={upcomingFeatures.map((feature) => ({
                      feature,
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    }))}
                  />
                )}
              </div>
            </div>
            <div className="p-4 w-full">
              <Button
                size="full-width"
                className="bg-panel text-default"
                onClick={handleContinueWithLegacy}
              >
                {translate("modelBuilderPaywall.continueWithLegacy")}
              </Button>
            </div>
          </div>

          <div className="relative bg-base border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
            <div className="p-6 flex flex-col flex-1">
              <h2 className="text-size-heading-2 font-semibold mb-2">
                {translate("modelBuilderPaywall.pro")}
              </h2>
              {isModelBuilderPaywallOn && (
                <p className="text-size-base text-subtle">
                  Pro plans and above
                </p>
              )}
              <div className="flex flex-col justify-between flex-1">
                <FeaturesList
                  items={[
                    {
                      feature: translate("modelBuilderPaywall.activeUpdates"),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    ...comparedFeatures.map(({ pro }) => ({
                      feature: pro,
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    })),
                  ]}
                />
                <FeaturesList
                  title={translate("modelBuilderPaywall.comingSoon")}
                  textColor="text-subtle"
                  items={upcomingFeatures.map((feature) => ({
                    feature,
                    Icon: CheckIcon,
                    iconColor: "text-subtle",
                  }))}
                />
              </div>
            </div>
            <div className="p-4 w-full">
              <Button
                size="full-width"
                variant="primary"
                onClick={handleUpgrade}
              >
                {translate("modelBuilderPaywall.upgrade")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};
