import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

export const CustomAttributesPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "customAttributes",
    imageSrc: "/images/custom-attributes-paywall-screenshot.webp",
    titleKey: "customAttributes.paywall.title",
    descriptionKeys: [
      "customAttributes.paywall.description1",
      "customAttributes.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "customAttributes.paywall.trial",
      plans: "customAttributes.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
