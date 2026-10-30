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

  const { comparedFeatures } = useComparedFeatures();

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
              <p className="text-size-base text-subtle">
                {translate("modelBuilderPaywall.freeAndPersonalPlans")}
              </p>
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
              <p className="text-size-base text-subtle">
                {translate("modelBuilderPaywall.proPlansAndAbove")}
              </p>
              <ModelBuilderProFeatures />
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

const useComparedFeatures = () => {
  const translate = useTranslate();
  const isLimitedModelBuildOn = useFeatureFlag("FLAG_LIMITED_MODEL_BUILD");
  const projectionAndLanguages = isLimitedModelBuildOn
    ? []
    : [
        {
          legacy: translate("modelBuilderPaywall.legacyProjection"),
          pro: translate("modelBuilderPaywall.proProjection"),
        },
        {
          legacy: translate("modelBuilderPaywall.legacyLanguages"),
          pro: translate("modelBuilderPaywall.proLanguages"),
        },
      ];

  const sameInBoth = (key: string) => {
    const feature = translate(`modelBuilderPaywall.${key}`);
    return { legacy: feature, pro: feature };
  };

  const comparedFeatures = [
    sameInBoth("multipleFilesPerLayer"),
    ...(isLimitedModelBuildOn ? [] : [sameInBoth("dxfAndCsvFiles")]),
    sameInBoth("filterSplitAndRules"),
    sameInBoth("pipeYearAndMaterials"),
    sameInBoth("customAttributes"),
    sameInBoth("zones"),
    ...(isLimitedModelBuildOn ? [] : [sameInBoth("customerPoints")]),
    sameInBoth("largeModels"),
    ...projectionAndLanguages,
    sameInBoth("saveBuildSettings"),
  ];

  const upcomingFeatures: string[] = [];

  return { comparedFeatures, upcomingFeatures };
};

export const ModelBuilderProFeatures = () => {
  const translate = useTranslate();
  const isLimitedModelBuildOn = useFeatureFlag("FLAG_LIMITED_MODEL_BUILD");
  const { comparedFeatures, upcomingFeatures } = useComparedFeatures();

  return (
    <div className="flex flex-col justify-between flex-1">
      <FeaturesList
        items={[
          ...(isLimitedModelBuildOn
            ? []
            : [
                {
                  feature: translate("modelBuilderPaywall.activeUpdates"),
                  Icon: CheckIcon,
                  iconColor: "text-success",
                },
              ]),
          ...comparedFeatures.map(({ pro }) => ({
            feature: pro,
            Icon: CheckIcon,
            iconColor: "text-success",
          })),
        ]}
      />
      {upcomingFeatures.length > 0 && (
        <FeaturesList
          title={translate("modelBuilderPaywall.comingSoon")}
          textColor="text-subtle"
          items={upcomingFeatures.map((feature) => ({
            feature,
            Icon: CheckIcon,
            iconColor: "text-subtle",
          }))}
        />
      )}
    </div>
  );
};
