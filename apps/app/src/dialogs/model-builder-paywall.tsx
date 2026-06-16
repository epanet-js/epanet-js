import { useSetAtom } from "jotai";
import { BaseDialog } from "src/components/dialog";
import { Button } from "src/components/elements";
import { dialogAtom } from "src/state/dialog";
import { useEarlyAccess } from "src/hooks/use-early-access";
import { useUserTracking } from "src/infra/user-tracking";
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
      title="Choose your model builder"
      size="md"
      isOpen={true}
      onClose={handleDismiss}
    >
      <div className="p-4">
        <p className="text-size-base text-default pb-6">
          We&apos;ve built an entirely new Pro Model Builder that dramatically
          speeds up your workflow and handles complex data automatically.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-base border rounded-md shadow-md overflow-hidden flex flex-col justify-between">
            <div className="p-6 flex flex-col flex-1">
              <h2 className="text-size-heading-2 font-semibold mb-2">Legacy</h2>
              <div className="flex flex-col justify-between flex-1">
                <FeaturesList
                  items={[
                    {
                      feature: "Maintenance only",
                      Icon: WarningIcon,
                      iconColor: "text-warning",
                    },
                    {
                      feature: "Pipe year and materials",
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    {
                      feature: "Only WGS84 projection",
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    {
                      feature: "English only",
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                  ]}
                />
                <FeaturesList
                  title="Not available:"
                  textColor="text-subtle"
                  items={[
                    {
                      feature: "Null values",
                      Icon: CloseIcon,
                      iconColor: "text-red-500",
                    },
                    {
                      feature: "Custom attributes",
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
                className="bg-base-hover text-default"
                onClick={handleContinueWithLegacy}
              >
                Continue with Legacy
              </Button>
            </div>
          </div>

          <div className="relative bg-base border border-purple-100 rounded-lg shadow-md shadow-purple-300 overflow-hidden flex flex-col justify-between">
            <div className="p-6 flex flex-col flex-1">
              <h2 className="text-size-heading-2 font-semibold mb-2">Pro</h2>
              <div className="flex flex-col justify-between flex-1">
                <FeaturesList
                  items={[
                    {
                      feature: "New features added frequently",
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    {
                      feature: "Pipe year and materials",
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    {
                      feature: "Preserve projection",
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                    {
                      feature: "Multiple languages",
                      Icon: CheckIcon,
                      iconColor: "text-success",
                    },
                  ]}
                />
                <FeaturesList
                  title="Coming soon:"
                  textColor="text-subtle"
                  items={[
                    {
                      feature: "Null values",
                      Icon: CheckIcon,
                      iconColor: "text-subtle",
                    },
                    {
                      feature: "Custom attributes",
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
                Upgrade
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BaseDialog>
  );
};
