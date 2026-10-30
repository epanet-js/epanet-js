import { ModelBuilderProFeatures } from "../model-builder-legacy-paywall";
import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

const AdvancedFeatures = () => (
  <div className="flex flex-col h-full overflow-y-auto px-4 bg-base">
    <div className="m-auto">
      <ModelBuilderProFeatures />
    </div>
  </div>
);

export const ModelBuildAdvancedPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "modelBuildAdvanced",
    media: <AdvancedFeatures />,
    titleKey: "modelBuildAdvanced.paywall.title",
    descriptionKeys: ["modelBuildAdvanced.paywall.description"],
    actionDescriptionKeys: {
      trial: "modelBuildAdvanced.paywall.trial",
      plans: "modelBuildAdvanced.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
