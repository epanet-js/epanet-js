import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

// PLACEHOLDER: the custom-attributes screenshot. Replace with one of the
// builder's split step, captured from invented data.
const MODEL_BUILD_ADVANCED_IMAGE_SRC =
  "/images/custom-attributes-paywall-screenshot.webp";

export const ModelBuildAdvancedPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "modelBuildAdvanced",
    imageSrc: MODEL_BUILD_ADVANCED_IMAGE_SRC,
    titleKey: "modelBuildAdvanced.paywall.title",
    descriptionKeys: [
      "modelBuildAdvanced.paywall.description1",
      "modelBuildAdvanced.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "modelBuildAdvanced.paywall.trial",
      plans: "modelBuildAdvanced.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
