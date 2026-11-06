import { useTranslate } from "src/hooks/use-translate";
import { CheckIcon } from "src/icons";
import { FeaturesList } from "../upgrade";
import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const advancedFeatureKeys = [
  "multipleFilesPerLayer",
  "filterSplitAndRules",
  "pipeYearAndMaterials",
  "customAttributes",
  "largeModels",
  "saveBuildSettings",
];

const AdvancedFeatures = () => {
  const translate = useTranslate();

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 bg-base">
      <div className="m-auto">
        <div className="flex flex-col justify-between flex-1">
          <FeaturesList
            items={advancedFeatureKeys.map((key) => ({
              feature: translate(`modelBuilderPaywall.${key}`),
              Icon: CheckIcon,
              iconColor: "text-success",
            }))}
          />
        </div>
      </div>
    </div>
  );
};

export const ModelBuilderPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "modelBuilder",
    media: <AdvancedFeatures />,
    titleKey: "modelBuilder.paywall.title",
    descriptionKeys: ["modelBuilder.paywall.description"],
    actionDescriptionKeys: {
      trial: "modelBuilder.paywall.trial",
      plans: "modelBuilder.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
