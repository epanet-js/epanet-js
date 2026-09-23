import { FeaturePaywall, type FeaturePaywallConfig } from "./feature-paywall";

export const CollectionsPaywallConnector = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const config: FeaturePaywallConfig = {
    feature: "selectionSets",
    imageSrc: "/images/collections-paywall.webp",
    titleKey: "collections.paywall.title",
    descriptionKeys: [
      "collections.paywall.description1",
      "collections.paywall.description2",
    ],
    actionDescriptionKeys: {
      trial: "collections.paywall.trial",
      plans: "collections.paywall.plans",
    },
    onTrialActivated: () => onClose(),
  };

  return <FeaturePaywall config={config} onClose={onClose} />;
};
