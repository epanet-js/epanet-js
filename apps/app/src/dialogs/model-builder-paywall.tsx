import { useSetAtom } from "jotai";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useUserTracking } from "src/infra/user-tracking";
import { useTranslate } from "src/hooks/use-translate";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { CheckIcon, CloseIcon, WarningIcon } from "src/icons";
import { FeaturesList } from "./upgrade";

export const ModelBuilderPaywallDialog = ({
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
  const isBuildCustomAttributesOn = useFeatureFlag("FLAG_BUILD_CA");

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
      setDialog({ type: "modelBuilderIframe" });
    }, "modelBuilderIframe");
  };

  const handleUpgrade = () => {
    userTracking.capture({
      name: "modelBuilder.paywall.upgradeClicked",
      source,
    });
    setDialog({ type: "upgrade", source: { kind: "modelBuilder" } });
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
              <div className="flex flex-col justify-between flex-1">
                <FeaturesList
                  items={[
                    {
                      feature: translate("modelBuilderPaywall.maintenanceOnly"),
                      Icon: WarningIcon,
                      iconColor: "text-warning",
                    },
                    {
                      feature: translate(
                        "modelBuilderPaywall.pipeYearAndMaterials",
                      ),
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    {
                      feature: translate(
                        "modelBuilderPaywall.legacyProjection",
                      ),
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    {
                      feature: translate("modelBuilderPaywall.legacyLanguages"),
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    ...(isBuildCustomAttributesOn
                      ? [
                          {
                            feature: translate(
                              "modelBuilderPaywall.customAttributes",
                            ),
                            Icon: CloseIcon,
                            iconColor: "text-red-500",
                          },
                        ]
                      : []),
                  ]}
                />
                <FeaturesList
                  title={translate("modelBuilderPaywall.notAvailable")}
                  textColor="text-subtle"
                  items={[
                    ...(isBuildCustomAttributesOn
                      ? []
                      : [
                          {
                            feature: translate(
                              "modelBuilderPaywall.customAttributes",
                            ),
                            Icon: CloseIcon,
                            iconColor: "text-red-500",
                          },
                        ]),
                    {
                      feature: translate(
                        "modelBuilderPaywall.saveBuildSettings",
                      ),
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    {
                      feature: translate("modelBuilderPaywall.filterData"),
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
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
              <div className="flex flex-col justify-between flex-1">
                <FeaturesList
                  items={[
                    {
                      feature: translate("modelBuilderPaywall.activeUpdates"),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    {
                      feature: translate(
                        "modelBuilderPaywall.pipeYearAndMaterials",
                      ),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    {
                      feature: translate("modelBuilderPaywall.proProjection"),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    {
                      feature: translate("modelBuilderPaywall.proLanguages"),
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    ...(isBuildCustomAttributesOn
                      ? [
                          {
                            feature: translate(
                              "modelBuilderPaywall.customAttributes",
                            ),
                            Icon: CheckIcon,
                            iconColor: "text-success",
                          },
                        ]
                      : []),
                  ]}
                />
                <FeaturesList
                  title={translate("modelBuilderPaywall.comingSoon")}
                  textColor="text-subtle"
                  items={[
                    ...(isBuildCustomAttributesOn
                      ? []
                      : [
                          {
                            feature: translate(
                              "modelBuilderPaywall.customAttributes",
                            ),
                            Icon: CheckIcon,
                            iconColor: "text-subtle",
                          },
                        ]),
                    {
                      feature: translate(
                        "modelBuilderPaywall.saveBuildSettings",
                      ),
                      Icon: CheckIcon,
                      iconColor: "text-subtle",
                    },
                    {
                      feature: translate("modelBuilderPaywall.filterData"),
                      Icon: CheckIcon,
                      iconColor: "text-subtle",
                    },
                  ]}
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
